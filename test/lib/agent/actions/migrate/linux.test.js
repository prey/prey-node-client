/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const rewire = require('rewire');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const { expect } = require('chai');

const MODULE = '../../../../../lib/agent/actions/migrate/linux';

// Builds linux.js with the session/exec/result seams stubbed. By default the
// signature verification and the pkexec-present check succeed, so a test can
// focus on the migrate flow and override only what it exercises.
function build({
  session, execImpl, result, verify, pkexec,
}) {
  const mod = rewire(MODULE);
  mod.__set__('detectSession', (cb) => cb(session || null));
  mod.__set__('notifyUser', () => {});
  mod.__set__('pkexecInstalled', () => (pkexec === undefined ? true : pkexec));
  mod.__set__('verifyRecovery', verify || ((_p, cb) => cb(null, 'deadbeef')));
  mod.__set__('readResult', (_f, cb) => cb(result || null));
  mod.__set__('runAsRoot', execImpl);
  return mod;
}

describe('migrate/linux', () => {
  const session = { user: 'alice', uid: 1000, display: ':0' };

  it('without a graphical session reports linux_no_graphical_session', (done) => {
    const mod = build({ session: null, execImpl: () => {} });
    mod.migrate((err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.equal('linux_no_graphical_session');
      done();
    });
  });

  it('without pkexec reports linux_pkexec_missing', (done) => {
    const mod = build({ session, execImpl: () => {}, pkexec: false });
    mod.migrate((err) => { expect(err.message).to.equal('linux_pkexec_missing'); done(); });
  });

  it('a failed signature verification reports the error without prompting', (done) => {
    let prompted = false;
    const mod = build({
      session,
      verify: (_p, cb) => cb(new Error('recovery_binary_untrusted')),
      execImpl: () => { prompted = true; },
    });
    mod.migrate((err) => {
      expect(err.message).to.equal('recovery_binary_untrusted');
      expect(prompted).to.equal(false);
      done();
    });
  });

  it('maps a dismissed pkexec (exit 126) to linux_user_cancelled', (done) => {
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb({ code: 126 }) });
    mod.migrate((err) => { expect(err.message).to.equal('linux_user_cancelled'); done(); });
  });

  it('maps a missing auth agent (exit 127) to linux_no_auth_agent', (done) => {
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb({ code: 127 }) });
    mod.migrate((err) => { expect(err.message).to.equal('linux_no_auth_agent'); done(); });
  });

  it('maps a killed (timeout) run to timeout', (done) => {
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb({ killed: true }) });
    mod.migrate((err) => { expect(err.message).to.equal('timeout'); done(); });
  });

  it('on success returns the reported phase', (done) => {
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb(null), result: 'OK:started' });
    mod.migrate((err, out) => {
      expect(err).to.equal(null);
      expect(out).to.deep.equal({ phase: 'launching' });
      done();
    });
  });

  it('maps a FAIL result token to an error', (done) => {
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb(null), result: 'FAIL:recovery_install_failed' });
    mod.migrate((err) => { expect(err.message).to.equal('recovery_install_failed'); done(); });
  });

  it('exit 0 but no result file reports recovery_migrate_failed', (done) => {
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb(null), result: null });
    mod.migrate((err) => { expect(err.message).to.equal('recovery_migrate_failed'); done(); });
  });

  it('refuses a locked session with linux_session_locked without prompting', (done) => {
    let prompted = false;
    const mod = build({
      session: { ...session, locked: true },
      execImpl: () => { prompted = true; },
    });
    mod.migrate((err) => {
      expect(err.message).to.equal('linux_session_locked');
      expect(prompted).to.equal(false);
      done();
    });
  });

  it('reports linux_impersonation_failed when a denial leaves no result', (done) => {
    // A sudoers/su denial: a non-0/126/127 error and no result file written.
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb({ code: 1 }), result: null });
    mod.migrate((err) => { expect(err.message).to.equal('linux_impersonation_failed'); done(); });
  });

  describe('verifyRecovery', () => {
    const keypair = crypto.generateKeyPairSync('ed25519');
    const pub = keypair.publicKey.export({ type: 'spki', format: 'pem' });
    const bin = Buffer.from('fake remrecovery binary bytes');

    // Returns verifyRecovery with fs stubbed to serve the given {bin, sig}
    // (either absent to simulate a missing file) and the test public key.
    function buildVerify(files) {
      const mod = rewire(MODULE);
      mod.__set__('PUBKEY_PEM', pub);
      mod.__set__('fs', {
        readFile: (p, cb) => {
          const key = String(p).endsWith('.sig') ? 'sig' : 'bin';
          if (files[key] === undefined) return cb(new Error('ENOENT'));
          return cb(null, files[key]);
        },
      });
      return mod.__get__('verifyRecovery');
    }

    it('accepts a valid signature and returns the sha256', (done) => {
      const sig = crypto.sign(null, bin, keypair.privateKey);
      buildVerify({ bin, sig })('/x/remrecovery', (err, sha) => {
        expect(err).to.equal(null);
        expect(sha).to.equal(crypto.createHash('sha256').update(bin).digest('hex'));
        done();
      });
    });

    it('rejects a missing signature as untrusted', (done) => {
      buildVerify({ bin })('/x/remrecovery', (err) => {
        expect(err.message).to.equal('recovery_binary_untrusted');
        done();
      });
    });

    it('rejects a wrong-length signature as untrusted', (done) => {
      buildVerify({ bin, sig: Buffer.alloc(10) })('/x/remrecovery', (err) => {
        expect(err.message).to.equal('recovery_binary_untrusted');
        done();
      });
    });

    it('rejects an invalid 64-byte signature as untrusted', (done) => {
      buildVerify({ bin, sig: Buffer.alloc(64) })('/x/remrecovery', (err) => {
        expect(err.message).to.equal('recovery_binary_untrusted');
        done();
      });
    });

    it('reports a missing binary', (done) => {
      buildVerify({ sig: Buffer.alloc(64) })('/x/remrecovery', (err) => {
        expect(err.message).to.equal('recovery_binary_missing');
        done();
      });
    });
  });

  describe('detectSession', () => {
    // Stubs loginctl: list-sessions returns ids; show-session returns the kv
    // block for that id from `sessions`.
    const withLoginctl = (ids, sessions) => {
      const mod = rewire(MODULE);
      mod.__set__('execFile', (bin, execArgs, opts, cb) => {
        if (execArgs[0] === 'list-sessions') return cb(null, `${ids.join('\n')}\n`);
        return cb(null, sessions[execArgs[1]] || '');
      });
      return mod.__get__('detectSession');
    };

    it('skips a greeter (Class != user) and returns the first user session', (done) => {
      const detect = withLoginctl(['c1', '2'], {
        c1: 'Active=yes\nType=wayland\nClass=greeter\nLockedHint=no\nUser=120\nName=gdm\nDisplay=:0',
        2: 'Active=yes\nType=wayland\nClass=user\nLockedHint=no\nUser=1000\nName=alice\nDisplay=:1',
      });
      detect((s) => {
        expect(s).to.deep.equal({
          user: 'alice', uid: 1000, display: ':1', locked: false,
        });
        done();
      });
    });

    it('reports a locked user session via LockedHint', (done) => {
      const detect = withLoginctl(['5'], {
        5: 'Active=yes\nType=x11\nClass=user\nLockedHint=yes\nUser=1000\nName=bob\nDisplay=:0',
      });
      detect((s) => {
        expect(s.user).to.equal('bob');
        expect(s.locked).to.equal(true);
        done();
      });
    });
  });

  describe('buildPayload', () => {
    it('pins the sha256 and runs the verified copy', () => {
      const buildPayload = rewire(MODULE).__get__('buildPayload');
      const payload = buildPayload('/cur/bin/remrecovery', 'abc123', '/tmp/r.result');
      expect(payload).to.include('SHA="abc123"');
      expect(payload).to.include('sha256sum --check --status');
      expect(payload).to.include('"$R" service install');
      expect(payload).to.include('"$R" migrate');
    });
  });

  describe('buildPayload execution', function execSuite() {
    this.timeout(20000);

    // Runs the real payload under bash with a fake remrecovery and returns the
    // result-file contents. `sha` overrides the pinned sha256 (to force a
    // mismatch); otherwise the fake binary's real sha256 is pinned.
    const runPayload = ({ remrecovery, sha }, cb) => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mig-payload-'));
      const recPath = path.join(dir, 'remrecovery');
      fs.writeFileSync(recPath, remrecovery, { mode: 0o755 });
      const realSha = crypto.createHash('sha256').update(fs.readFileSync(recPath)).digest('hex');
      const resultFile = path.join(dir, 'migrate.result');
      const buildPayload = rewire(MODULE).__get__('buildPayload');
      const payload = buildPayload(recPath, sha === undefined ? realSha : sha, resultFile);
      const payloadFile = path.join(dir, 'payload.sh');
      fs.writeFileSync(payloadFile, payload);
      execFile('bash', [payloadFile], { timeout: 15000 }, () => {
        let out = null;
        try { out = fs.readFileSync(resultFile, 'utf8').trim(); } catch (e) { out = null; }
        fs.rmSync(dir, { recursive: true, force: true });
        cb(out);
      });
    };

    const fake = (migrateBody, statusJson) => `#!/bin/bash
case "$1" in
  service) exit 0 ;;
  migrate) ${migrateBody} ;;
  status) echo '${statusJson}' ;;
esac
`;

    it('emits OK:started when status reports launching', (done) => {
      runPayload({ remrecovery: fake('exit 0', '{"phase":"launching"}') }, (out) => {
        expect(out).to.equal('OK:started');
        done();
      });
    });

    it('treats recovery_owner_migration_active as in progress, not a failure', (done) => {
      const rec = fake('echo recovery_owner_migration_active >&2; exit 1', '{"phase":"launching"}');
      runPayload({ remrecovery: rec }, (out) => {
        expect(out).to.equal('OK:started');
        done();
      });
    });

    it('emits FAIL:deprovisioning when status reports deprovisioning', (done) => {
      const rec = fake('exit 0', '{"deprovisioning":true,"phase":"admitted"}');
      runPayload({ remrecovery: rec }, (out) => {
        expect(out).to.equal('FAIL:deprovisioning');
        done();
      });
    });

    it('emits FAIL:recovery_binary_untrusted on a sha mismatch', (done) => {
      runPayload({ remrecovery: fake('exit 0', '{"phase":"launching"}'), sha: 'f'.repeat(64) }, (out) => {
        expect(out).to.equal('FAIL:recovery_binary_untrusted');
        done();
      });
    });
  });

  describe('suArgs', () => {
    it('uses /usr/bin/su when sudo is not sudo-rs', (done) => {
      const mod = rewire(MODULE);
      mod.__set__('isSudoRs', (cb) => cb(false));
      mod.__get__('suArgs')('alice', 'echo hi', (args) => {
        expect(args).to.deep.equal(['-n', '/usr/bin/su', 'alice', '-c', 'echo hi']);
        done();
      });
    });

    it('uses the prey-su wrapper on sudo-rs when present', (done) => {
      const mod = rewire(MODULE);
      mod.__set__('isSudoRs', (cb) => cb(true));
      mod.__set__('PREY_SU_WRAPPER', '/opt/prey/current/lib/system/linux/prey-su');
      mod.__set__('fs', { existsSync: () => true });
      mod.__get__('suArgs')('alice', 'echo hi', (args) => {
        expect(args).to.deep.equal(['-n', '/opt/prey/current/lib/system/linux/prey-su', 'alice', '-c', 'echo hi']);
        done();
      });
    });

    it('falls back to /usr/bin/su on sudo-rs when the wrapper is absent', (done) => {
      const mod = rewire(MODULE);
      mod.__set__('isSudoRs', (cb) => cb(true));
      mod.__set__('fs', { existsSync: () => false });
      mod.__get__('suArgs')('alice', 'echo hi', (args) => {
        expect(args[1]).to.equal('/usr/bin/su');
        done();
      });
    });
  });
});
