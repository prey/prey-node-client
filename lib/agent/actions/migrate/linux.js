// @ts-check
const fs = require('fs');
const os = require('os');
const { execFile } = require('child_process');
const common = require('../../common');
const recovery = require('../../../system/recovery');

const logger = common.logger.prefix('migrate');

// Llave pública Ed25519 del updater de goprey (misma que firma los paquetes y
// el remrecovery de Linux). Defensa en profundidad: el payload verifica en
// disco el binario empaquetado antes de correrlo como root.
const PUBKEY_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAenBd/Yx/AKrbbzixs+mvzZNRHyE6BiG4W+CSACDaumI=',
  '-----END PUBLIC KEY-----',
].join('\n');

const EXEC_TIMEOUT_MS = 180000;

/**
 * Detecta la sesión gráfica activa (usuario, uid, DISPLAY) con loginctl.
 * rewire la reemplaza en tests.
 * @param {(s: {user:string, uid:number, display:string}|null) => void} cb
 */
const detectSession = (cb) => {
  execFile('loginctl', ['list-sessions', '--no-legend'], { timeout: 5000 }, (err, stdout) => {
    if (err) return cb(null);
    const ids = String(stdout).trim().split('\n').map((l) => l.trim().split(/\s+/)[0]).filter(Boolean);
    const tryNext = (i) => {
      if (i >= ids.length) return cb(null);
      execFile('loginctl', ['show-session', ids[i], '-p', 'Active', '-p', 'Type', '-p', 'User', '-p', 'Name', '-p', 'Display'],
        { timeout: 5000 }, (e, out) => {
          if (e) return tryNext(i + 1);
          const kv = {};
          String(out).trim().split('\n').forEach((line) => { const j = line.indexOf('='); if (j > 0) kv[line.slice(0, j)] = line.slice(j + 1); });
          const graphical = kv.Type === 'x11' || kv.Type === 'wayland';
          if (kv.Active === 'yes' && graphical && kv.User) {
            return cb({ user: kv.Name, uid: Number(kv.User), display: kv.Display || ':0' });
          }
          return tryNext(i + 1);
        });
    };
    tryNext(0);
  });
};

/** Aviso al usuario antes del diálogo de polkit (best-effort). rewire lo reemplaza. */
const notifyUser = (session) => {
  const env = { ...process.env, DISPLAY: session.display, XDG_RUNTIME_DIR: `/run/user/${session.uid}` };
  execFile('sudo', ['-n', '/usr/bin/su', session.user, '-c',
    'notify-send "Prey" "Prey va a pedir la clave de administrador para migrar al nuevo agente."'],
    { timeout: 5000, env }, () => {});
};

/**
 * Corre el payload como root vía pkexec dentro de la sesión del usuario.
 * El payload se pasa en base64 para esquivar el anidado de comillas.
 * rewire lo reemplaza en tests.
 * @param {string} user @param {number} uid @param {string} display
 * @param {string} payload @param {(err: {code?:number}|null) => void} cb
 */
const runAsRoot = (user, uid, display, payload, cb) => {
  const b64 = Buffer.from(payload, 'utf8').toString('base64');
  const inner = `export XDG_RUNTIME_DIR=/run/user/${uid} `
    + `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${uid}/bus; `
    + `systemd-run --user --wait --collect -E DISPLAY=${display} `
    + `/usr/bin/pkexec /bin/bash -c "$(printf %s '${b64}' | base64 -d)"`;
  execFile('sudo', ['-n', '/usr/bin/su', user, '-c', inner], { timeout: EXEC_TIMEOUT_MS }, (err) => {
    if (!err) return cb(null);
    cb({ code: typeof err.code === 'number' ? err.code : undefined });
  });
};

/** Lee y borra el archivo de resultado que escribió el payload root. rewire lo reemplaza. */
const readResult = (file, cb) => {
  fs.readFile(file, 'utf8', (err, data) => {
    if (!err) fs.unlink(file, () => {});
    cb(err ? null : String(data).trim());
  });
};

/** Construye el payload bash (root). */
const buildPayload = (recPath, sigPath, resultFile) => `set -u
REC="${recPath}"; SIG="${sigPath}"; RES="${resultFile}"
emit(){ echo "$1" > "$RES"; chmod 644 "$RES" 2>/dev/null || true; exit 0; }
if command -v openssl >/dev/null 2>&1 && [ -f "$SIG" ] && openssl pkeyutl -help 2>&1 | grep -q rawin; then
  P="$(mktemp)"; cat > "$P" <<'PUB'
${PUBKEY_PEM}
PUB
  if ! openssl pkeyutl -verify -pubin -inkey "$P" -rawin -in "$REC" -sigfile "$SIG" >/dev/null 2>&1; then
    rm -f "$P"; emit "FAIL:recovery_binary_untrusted"
  fi
  rm -f "$P"
fi
"$REC" service install >/dev/null 2>&1 || emit "FAIL:recovery_install_failed"
"$REC" service start   >/dev/null 2>&1 || emit "FAIL:recovery_start_failed"
M="$(mktemp)"
if ! "$REC" migrate >"$M" 2>&1; then
  grep -qi recovery_owner_deprovisioning "$M" && { rm -f "$M"; emit "FAIL:deprovisioning"; }
  rm -f "$M"; emit "FAIL:recovery_migrate_failed"
fi
rm -f "$M"
for i in $(seq 1 30); do
  S="$("$REC" status 2>/dev/null)"
  printf '%s' "$S" | grep -Eq '"phase":"(launching|launched|succeeded)"' && emit "OK:started"
  printf '%s' "$S" | grep -q '"phase":"failed"' && emit "FAIL:recovery_migrate_failed"
  sleep 3
done
emit "OK:admitted"
`;

/**
 * Migra este equipo Linux a goprey pidiendo la clave al usuario (pkexec).
 * Autocontenido: no usa el poll/socket de index.js.
 * @param {(err: (Error|null), out?: object) => void} cb
 */
exports.migrate = (cb) => {
  detectSession((session) => {
    if (!session) {
      logger.warn('migrate: no active graphical session');
      return cb(new Error('linux_no_graphical_session'));
    }
    const recPath = recovery.recoveryPath();
    const sigPath = `${recPath}.sig`;
    const resultFile = `${os.tmpdir()}/prey-migrate-${process.pid}-${Date.now()}.result`;
    notifyUser(session);
    const payload = buildPayload(recPath, sigPath, resultFile);
    logger.info(`migrate: prompting ${session.user} (uid ${session.uid}) for authorization`);
    runAsRoot(session.user, session.uid, session.display, payload, (err) => {
      if (err && err.code === 126) return cb(new Error('linux_user_cancelled'));
      if (err && err.code === 127) return cb(new Error('linux_no_auth_agent'));
      readResult(resultFile, (result) => {
        if (!result) return cb(new Error('recovery_migrate_failed'));
        if (result.startsWith('OK:')) {
          const phase = result === 'OK:started' ? 'launching' : 'admitted';
          logger.info(`migrate: started (${phase})`);
          return cb(null, { phase });
        }
        const token = result.slice('FAIL:'.length) || 'recovery_migrate_failed';
        logger.warn(`migrate: failed (${token})`);
        return cb(new Error(token));
      });
    });
  });
};
