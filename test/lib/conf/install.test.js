/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('conf/install activate_new_version rollback', () => {
  let install;
  let runSyncedStub;
  let removeStub;
  let setCurrentStub;
  let logStub;

  const NEW_VERSION = '1.13.40';
  const PREVIOUS_VERSION = '1.13.39';

  beforeEach(() => {
    install = rewire('../../../lib/conf/install');

    runSyncedStub = sinon.stub();
    removeStub = sinon.stub().callsFake((v, cb) => cb());
    setCurrentStub = sinon.stub().callsFake((v, cb) => cb());
    logStub = sinon.stub();

    install.__set__('run_synced', runSyncedStub);
    install.__set__('shared', {
      log: logStub,
      version_manager: { remove: removeStub, set_current: setCurrentStub },
    });
    install.__set__('common', { version: PREVIOUS_VERSION });
    install.__set__('paths', {
      versions: String.raw`C:\Windows\Prey\versions`,
      bin: 'prey',
    });
  });

  afterEach(() => {
    delete process.env.UPGRADING_FROM;
    sinon.restore();
  });

  it('removes the new version and restores current to the previous version on failure', (done) => {
    // child exits with code 1 (activation failed) -> rollback
    runSyncedStub.callsFake((bin, args, opts, cb) => cb(null, 1));

    install.activate_new_version(NEW_VERSION, (err) => {
      expect(removeStub.calledOnce).to.equal(true);
      expect(removeStub.firstCall.args[0]).to.equal(NEW_VERSION);

      expect(setCurrentStub.calledOnce).to.equal(true);
      expect(setCurrentStub.firstCall.args[0]).to.equal(PREVIOUS_VERSION);

      // remove must happen before restoring current
      expect(removeStub.calledBefore(setCurrentStub)).to.equal(true);

      // a rolled-back upgrade must report failure so the updater tracks the attempt
      expect(err).to.be.an('error');
      expect(err.message).to.contain('exit code 1');
      done();
    });
  });

  it('restores current even when run_synced reports a spawn error', (done) => {
    runSyncedStub.callsFake((bin, args, opts, cb) => cb(new Error('spawn EROFS')));

    install.activate_new_version(NEW_VERSION, (err) => {
      expect(err).to.be.an('error');
      expect(removeStub.calledOnce).to.equal(true);
      expect(setCurrentStub.calledOnce).to.equal(true);
      expect(setCurrentStub.firstCall.args[0]).to.equal(PREVIOUS_VERSION);
      done();
    });
  });

  it('does not treat ALREADY_CURRENT as a rollback restore error', (done) => {
    runSyncedStub.callsFake((bin, args, opts, cb) => cb(null, 1));
    setCurrentStub.callsFake((v, cb) => {
      const e = new Error('already current');
      e.code = 'ALREADY_CURRENT';
      cb(e);
    });

    install.activate_new_version(NEW_VERSION, () => {
      const logged = logStub.getCalls().map((c) => c.args[0]).join('\n');
      expect(logged).to.not.contain('could not restore current');
      done();
    });
  });

  it('does not roll back on successful activation', (done) => {
    runSyncedStub.callsFake((bin, args, opts, cb) => cb(null, 0));

    install.activate_new_version(NEW_VERSION, (err) => {
      expect(err == null).to.equal(true);
      expect(removeStub.called).to.equal(false);
      expect(setCurrentStub.called).to.equal(false);
      done();
    });
  });
});
