/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const fs = require('fs');
const os = require('os');
const path = require('path');

describe('conf/install activate_new_version rollback', () => {
  let install;
  let runSyncedStub;
  let removeStub;
  let setCurrentStub;
  let logStub;
  let saveFailureStub;

  const NEW_VERSION = '1.13.40';
  const PREVIOUS_VERSION = '1.13.39';

  beforeEach(() => {
    install = rewire('../../../lib/conf/install');

    runSyncedStub = sinon.stub();
    removeStub = sinon.stub().callsFake((v, cb) => cb());
    setCurrentStub = sinon.stub().callsFake((v, cb) => cb());
    logStub = sinon.stub();
    saveFailureStub = sinon.stub().callsFake((data, cb) => cb(null));

    install.__set__('run_synced', runSyncedStub);
    install.__set__('shared', {
      log: logStub,
      version_manager: { remove: removeStub, set_current: setCurrentStub },
    });
    install.__set__('common', { version: PREVIOUS_VERSION });
    install.__set__('pkg', { save_upgrade_failure: saveFailureStub });
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

  it('stores the activation failure so the agent can back off and report it', (done) => {
    runSyncedStub.callsFake((bin, args, opts, cb) => cb(null, 1));

    install.activate_new_version(NEW_VERSION, (err) => {
      expect(err).to.be.an('error');
      expect(saveFailureStub.calledOnce).to.equal(true);
      const record = saveFailureStub.firstCall.args[0];
      expect(record.version).to.equal(NEW_VERSION);
      expect(record.from).to.equal(PREVIOUS_VERSION);
      expect(record.code).to.equal(1);
      expect(record.message).to.contain('exit code 1');
      // stored after the rollback finished
      expect(setCurrentStub.calledBefore(saveFailureStub)).to.equal(true);
      done();
    });
  });

  it('writes the activation failure to the agent log file', (done) => {
    const logFile = path.join(os.tmpdir(), `prey-install-test-${process.pid}-${Date.now()}.log`);
    install.__set__('paths', { versions: String.raw`C:\Windows\Prey\versions`, bin: 'prey', log_file: logFile });
    runSyncedStub.callsFake((bin, args, opts, cb) => cb(null, 1));

    install.activate_new_version(NEW_VERSION, () => {
      const content = fs.readFileSync(logFile, 'utf8');
      fs.unlinkSync(logFile);
      expect(content).to.contain('[updater] Activation of 1.13.40 failed (exit code 1)');
      done();
    });
  });

  it('still reports the failure when storing it fails', (done) => {
    saveFailureStub.callsFake((data, cb) => cb(new Error('db locked')));
    runSyncedStub.callsFake((bin, args, opts, cb) => cb(null, 1));

    install.activate_new_version(NEW_VERSION, (err) => {
      expect(err).to.be.an('error');
      expect(err.message).to.contain('exit code 1');
      done();
    });
  });

  it('does not store a failure on successful activation', (done) => {
    runSyncedStub.callsFake((bin, args, opts, cb) => cb(null, 0));

    install.activate_new_version(NEW_VERSION, () => {
      expect(saveFailureStub.called).to.equal(false);
      done();
    });
  });
});

// The agent runs `config upgrade <version>` -> install.remote(), whose `done` callback
// detaches and then activates. Exercise that path, not activate_new_version directly.
describe('conf/install remote() -> activation failure path', () => {
  let install;
  let saveFailureStub;
  let fakeProcess;

  beforeEach(() => {
    install = rewire('../../../lib/conf/install');
    saveFailureStub = sinon.stub().callsFake((data, cb) => cb(null));

    fakeProcess = {
      env: {},
      platform: 'darwin',
      stdout: { write: sinon.stub() },
      stderr: { write: sinon.stub() },
    };

    install.__set__('process', fakeProcess);
    install.__set__('setTimeout', (fn) => fn());
    install.__set__('fs', { ...fs, openSync: sinon.stub().returns(99), appendFileSync: sinon.stub() });
    install.__set__('system', { tempfile_path: (f) => f });
    install.__set__('common', { version: '1.13.41' });
    install.__set__('paths', { versions: '/usr/local/lib/prey/versions', bin: 'prey', log_file: '/var/log/prey.log' });
    install.__set__('shared', {
      log: sinon.stub(),
      version_manager: {
        remove: sinon.stub().callsFake((v, cb) => cb()),
        set_current: sinon.stub().callsFake((v, cb) => cb()),
      },
    });
    install.__set__('run_synced', (bin, args, opts, cb) => cb(null, 1));
    install.__set__('pkg', {
      get_version: (version, dest, cb) => cb(null, version),
      save_upgrade_failure: saveFailureStub,
    });
  });

  afterEach(() => sinon.restore());

  it('records the failure when the post-detach activation fails', (done) => {
    // remote() swaps process.stdout for a file descriptor after detaching
    const stdoutWrite = fakeProcess.stdout.write;
    install.remote({ version: '1.13.42' }, (err) => {
      expect(err).to.be.an('error');
      expect(stdoutWrite.calledWith('YOUARENOTMYFATHER')).to.equal(true);
      expect(saveFailureStub.calledOnce).to.equal(true);
      expect(saveFailureStub.firstCall.args[0].version).to.equal('1.13.42');
      expect(saveFailureStub.firstCall.args[0].from).to.equal('1.13.41');
      done();
    });
  });
});
