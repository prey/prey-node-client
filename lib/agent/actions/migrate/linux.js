// @ts-check
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { exec, execFile } = require('child_process');
const common = require('../../common');
const paths = require('../../../system/paths');
const recovery = require('../../../system/recovery');

const logger = common.logger.prefix('migrate');

// goprey updater Ed25519 public key (the same key that signs the packages and
// the Linux remrecovery). Node verifies the bundled binary's detached signature
// before asking for the password, and the root payload re-checks a sha256-pinned
// copy before executing it (defense in depth, no TOCTOU).
const PUBKEY_PEM = [
  '-----BEGIN PUBLIC KEY-----',
  'MCowBQYDK2VwAyEAenBd/Yx/AKrbbzixs+mvzZNRHyE6BiG4W+CSACDaumI=',
  '-----END PUBLIC KEY-----',
].join('\n');

// Ed25519 detached signature length (releasesign.SignatureSize in goprey).
const SIG_SIZE = 64;
// 10 min. This single exec covers the payload's own worst-case deadline budget
// for the remrecovery subcommands AND the time the user spends typing the
// password at the pkexec dialog, so it must comfortably exceed both; the old
// 180 s was shorter than the payload budget alone.
const EXEC_TIMEOUT_MS = 600000;
const SU_CMD = '/usr/bin/su';
const PKEXEC_BIN = '/usr/bin/pkexec';
// Wrapper used on sudo-rs systems (Ubuntu 26+): the sudoers rule allows this
// wrapper, not `su` with a wildcard argument. Mirrors conf/switcher.js and
// system/utils/runner.js. The stable `current` symlink survives auto-updates.
const PREY_SU_WRAPPER = path.join(paths.current, 'lib', 'system', 'linux', 'prey-su');

/**
 * Verifies the bundled remrecovery against its detached .sig with the goprey
 * updater key and returns the binary's sha256 (hex). Fail-closed: a missing,
 * short or invalid signature yields recovery_binary_untrusted; a missing binary
 * yields recovery_binary_missing. Pure Node crypto (no OpenSSL dependency).
 * rewire replaces this in tests.
 * @param {string} recPath
 * @param {(err: (Error|null), sha256?: string) => void} cb
 */
const verifyRecovery = (recPath, cb) => {
  fs.readFile(recPath, (binErr, bin) => {
    if (binErr) return cb(new Error('recovery_binary_missing'));
    return fs.readFile(`${recPath}.sig`, (sigErr, sig) => {
      if (sigErr || sig.length !== SIG_SIZE) return cb(new Error('recovery_binary_untrusted'));
      let ok = false;
      try {
        ok = crypto.verify(null, bin, crypto.createPublicKey(PUBKEY_PEM), sig);
      } catch (e) {
        ok = false;
      }
      if (!ok) return cb(new Error('recovery_binary_untrusted'));
      return cb(null, crypto.createHash('sha256').update(bin).digest('hex'));
    });
  });
};

/**
 * Detects the active graphical session with loginctl. Requires Class=user so the
 * display manager greeter (e.g. gdm) is skipped, and reports LockedHint so the
 * caller can refuse to prompt on a locked screen (no dialog would be shown).
 * rewire replaces this in tests.
 * @param {(s: {user:string, uid:number, display:string, locked:boolean}|null) => void} cb
 */
const detectSession = (cb) => {
  execFile('loginctl', ['list-sessions', '--no-legend'], { timeout: 5000 }, (err, stdout) => {
    if (err) return cb(null);
    const ids = String(stdout).trim().split('\n')
      .map((l) => l.trim().split(/\s+/)[0])
      .filter(Boolean);
    const props = ['Active', 'Type', 'Class', 'LockedHint', 'User', 'Name', 'Display'];
    const args = (id) => ['show-session', id].concat(props.flatMap((p) => ['-p', p]));
    const tryNext = (i) => {
      if (i >= ids.length) return cb(null);
      return execFile('loginctl', args(ids[i]), { timeout: 5000 }, (e, out) => {
        if (e) return tryNext(i + 1);
        const kv = {};
        String(out).trim().split('\n').forEach((line) => { const j = line.indexOf('='); if (j > 0) kv[line.slice(0, j)] = line.slice(j + 1); });
        const graphical = kv.Type === 'x11' || kv.Type === 'wayland';
        if (kv.Active === 'yes' && graphical && kv.Class === 'user' && kv.User) {
          return cb({
            user: kv.Name,
            uid: Number(kv.User),
            display: kv.Display || ':0',
            locked: kv.LockedHint === 'yes',
          });
        }
        return tryNext(i + 1);
      });
    };
    return tryNext(0);
  });
};

/**
 * Detects sudo-rs (Ubuntu 26+), which does not support wildcards in sudoers
 * command arguments. rewire replaces this in tests.
 * @param {(sudoRs: boolean) => void} cb
 */
const isSudoRs = (cb) => {
  exec('sudo -V', { timeout: 5000 }, (err, stdout, stderr) => {
    cb(!err && `${stdout || ''}${stderr || ''}`.toLowerCase().includes('sudo-rs'));
  });
};

/**
 * Builds the `sudo` argv that impersonates `user` and runs `inner` in bash.
 * On sudo-rs it uses the prey-su wrapper (the sudoers rule allows the wrapper,
 * not `su` with a wildcard); otherwise /usr/bin/su. Mirrors runner.js.
 * @param {string} user @param {string} inner
 * @param {(args: string[]) => void} cb
 */
const suArgs = (user, inner, cb) => {
  isSudoRs((sudoRs) => {
    if (sudoRs && fs.existsSync(PREY_SU_WRAPPER)) {
      return cb(['-n', PREY_SU_WRAPPER, user, '-c', inner]);
    }
    return cb(['-n', SU_CMD, user, '-c', inner]);
  });
};

/** Best-effort notice before the polkit dialog. rewire replaces this in tests. */
const notifyUser = (session) => {
  // su/sudo scrub the environment, so export the session vars inside the -c.
  const inner = `export DISPLAY=${session.display} `
    + `XDG_RUNTIME_DIR=/run/user/${session.uid} `
    + `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${session.uid}/bus; `
    + 'notify-send "Prey" "Prey will ask for the administrator password to migrate to the new agent."';
  suArgs(session.user, inner, (args) => {
    execFile('sudo', args, { timeout: 5000 }, () => {});
  });
};

/**
 * Runs the payload as root via pkexec inside the user's session. The payload is
 * passed base64-encoded to avoid nested quoting. rewire replaces this in tests.
 * @param {string} user @param {number} uid @param {string} display
 * @param {string} payload
 * @param {(err: {code?:number, killed?:boolean}|null) => void} cb
 */
const runAsRoot = (user, uid, display, payload, cb) => {
  const b64 = Buffer.from(payload, 'utf8').toString('base64');
  const inner = `export XDG_RUNTIME_DIR=/run/user/${uid} `
    + `DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/${uid}/bus; `
    + `systemd-run --user --wait --collect -E DISPLAY=${display} `
    + `${PKEXEC_BIN} /bin/bash -c "$(printf %s '${b64}' | base64 -d)"`;
  suArgs(user, inner, (args) => {
    execFile('sudo', args, { timeout: EXEC_TIMEOUT_MS }, (err) => {
      if (!err) return cb(null);
      return cb({
        code: typeof err.code === 'number' ? err.code : undefined,
        killed: Boolean(err.killed),
      });
    });
  });
};

/**
 * Whether pkexec is installed (a separate package on Ubuntu 22.04+). rewire
 * replaces this in tests.
 */
const pkexecInstalled = () => fs.existsSync(PKEXEC_BIN);

/** Reads and removes the result file written by the root payload. rewire replaces this in tests. */
const readResult = (file, cb) => {
  fs.readFile(file, 'utf8', (err, data) => {
    if (!err) fs.unlink(file, () => {});
    cb(err ? null : String(data).trim());
  });
};

/**
 * Builds the root bash payload. It copies remrecovery into a private root-owned
 * exec dir (under /var/lib, which — unlike /tmp — is not noexec on hardened
 * hosts), re-checks the Node-pinned sha256 (coreutils sha256sum, present on
 * 20.04+), and runs that verified copy — closing the TOCTOU window without
 * OpenSSL. A migrate that reports recovery_owner_migration_active is not a
 * failure: a migration is already in progress, so it falls through to the
 * status loop. The status loop also fails on a real deprovisioning
 * ("deprovisioning":true in the status JSON; there is no owner error token).
 *
 * Linux "admitted" limitation: Node runs as the unprivileged prey user and
 * cannot poll the root-only owner socket once pkexec returns, so it reports
 * OK:admitted as soon as the owner accepts the operation. A later download or
 * trust failure is not observable by Node — goprey reports the final outcome —
 * and the 4h migrate_stalled cap in index.js does NOT apply to this Linux path.
 * @param {string} recPath @param {string} sha256 @param {string} resultFile
 */
const buildPayload = (recPath, sha256, resultFile) => `set -u
REC="${recPath}"; SHA="${sha256}"; RES="${resultFile}"
emit(){ echo "$1" > "$RES"; chmod 644 "$RES" 2>/dev/null || true; exit 0; }
D="$(mktemp -d -p /var/lib 2>/dev/null)" || D="$(mktemp -d)"
[ -n "$D" ] || emit "FAIL:recovery_tmp_failed"
trap 'rm -rf "$D"' EXIT
cp "$REC" "$D/remrecovery" 2>/dev/null || emit "FAIL:recovery_binary_missing"
echo "$SHA  $D/remrecovery" | sha256sum --check --status || emit "FAIL:recovery_binary_untrusted"
chmod 0700 "$D/remrecovery"
R="$D/remrecovery"
M="$D/migrate.out"
"$R" service install >/dev/null 2>&1 || emit "FAIL:recovery_install_failed"
"$R" service start   >/dev/null 2>&1 || emit "FAIL:recovery_start_failed"
if ! "$R" migrate >"$M" 2>&1; then
  grep -qi recovery_owner_migration_active "$M" || emit "FAIL:recovery_migrate_failed"
fi
for i in $(seq 1 30); do
  S="$("$R" status 2>/dev/null)"
  printf '%s' "$S" | grep -q '"deprovisioning":true' && emit "FAIL:deprovisioning"
  printf '%s' "$S" | grep -Eq '"phase":"(launching|launched|succeeded)"' && emit "OK:started"
  printf '%s' "$S" | grep -q '"phase":"failed"' && emit "FAIL:recovery_migrate_failed"
  sleep 3
done
emit "OK:admitted"
`;

/**
 * Migrates this Linux device to goprey, asking the user for the password via
 * pkexec. Self-contained: it does not use the index.js poll/socket path.
 * @param {(err: (Error|null), out?: object) => void} cb
 */
exports.migrate = (cb) => {
  detectSession((session) => {
    if (!session) {
      logger.warn('migrate: no active graphical session');
      return cb(new Error('linux_no_graphical_session'));
    }
    if (session.locked) {
      // pkexec shows no dialog on a locked screen, so the prompt would silently
      // burn the whole timeout. Refuse before prompting.
      logger.warn('migrate: the active session is locked');
      return cb(new Error('linux_session_locked'));
    }
    if (!pkexecInstalled()) {
      logger.warn('migrate: pkexec is not installed');
      return cb(new Error('linux_pkexec_missing'));
    }
    const recPath = recovery.recoveryPath();
    return verifyRecovery(recPath, (vErr, sha256) => {
      if (vErr) {
        logger.warn(`migrate: ${vErr.message}`);
        return cb(vErr);
      }
      // Node runs as the unprivileged prey user, so the result file lives in a
      // private 0700 dir prey owns: root writes the file inside it, and prey can
      // still delete the file and the dir. A predictable path in world-writable
      // /tmp could be pre-created by a local attacker and could not be removed.
      return fs.mkdtemp(path.join(os.tmpdir(), 'prey-migrate-'), (mkErr, dir) => {
        if (mkErr) {
          logger.warn(`migrate: ${mkErr.message}`);
          return cb(new Error('recovery_tmp_failed'));
        }
        const resultFile = path.join(dir, 'migrate.result');
        const cleanup = () => fs.rm(dir, { recursive: true, force: true }, () => {});
        notifyUser(session);
        const payload = buildPayload(recPath, String(sha256), resultFile);
        logger.info(`migrate: prompting ${session.user} (uid ${session.uid}) for authorization`);
        return runAsRoot(session.user, session.uid, session.display, payload, (err) => {
          if (err && err.killed) {
            cleanup();
            logger.warn('migrate: timed out; migration may still be running in the owner');
            return cb(new Error('timeout'));
          }
          if (err && err.code === 126) { cleanup(); return cb(new Error('linux_user_cancelled')); }
          if (err && err.code === 127) { cleanup(); return cb(new Error('linux_no_auth_agent')); }
          return readResult(resultFile, (result) => {
            cleanup();
            if (!result) {
              // err here is neither 126/127 nor killed: a sudoers/su/impersonation
              // denial that never ran the payload, so no result was written.
              if (err) return cb(new Error('linux_impersonation_failed'));
              return cb(new Error('recovery_migrate_failed'));
            }
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
    });
  });
};
