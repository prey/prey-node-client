// @ts-check
const rewire = require('rewire');
const { expect } = require('chai');

const MODULE = '../../../../../lib/agent/actions/migrate/linux';

/** Construye linux.js con exec y lectura de resultado stubbeados. */
function build({ session, execImpl, result }) {
  const mod = rewire(MODULE);
  mod.__set__('detectSession', (cb) => cb(session || null));
  mod.__set__('notifyUser', () => {});
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

  it('maps a dismissed pkexec (exit 126) to linux_user_cancelled', (done) => {
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb({ code: 126 }) });
    mod.migrate((err) => { expect(err.message).to.equal('linux_user_cancelled'); done(); });
  });

  it('maps a missing auth agent (exit 127) to linux_no_auth_agent', (done) => {
    const mod = build({ session, execImpl: (u, i, d, p, cb) => cb({ code: 127 }) });
    mod.migrate((err) => { expect(err.message).to.equal('linux_no_auth_agent'); done(); });
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
});
