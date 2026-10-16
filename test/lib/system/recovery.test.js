/* eslint-disable no-underscore-dangle */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('system/recovery', () => {
  let recovery;
  let fsStub;
  let execFileStub;

  beforeEach(() => {
    recovery = rewire('../../../lib/system/recovery');
    fsStub = { existsSync: sinon.stub().returns(true) };
    execFileStub = sinon.stub();
    recovery.__set__('fs', fsStub);
    recovery.__set__('execFile', execFileStub);
    recovery.__set__('paths', { install: '/inst', current: '/inst/current' });
  });

  afterEach(() => sinon.restore());

  it('is the installed copy next to wpxsvc.exe on Windows', () => {
    recovery.__set__('platform', 'win32');
    expect(recovery.recoveryPath()).to.match(/inst[\\/]prey-recovery\.exe$/);
  });

  it('is current/bin/prey-recovery on macOS', () => {
    recovery.__set__('platform', 'darwin');
    expect(recovery.recoveryPath()).to.match(/inst[\\/]current[\\/]bin[\\/]prey-recovery$/);
  });

  it('does not exist on Linux', () => {
    recovery.__set__('platform', 'linux');
    expect(recovery.recoveryPath()).to.equal(null);
    expect(recovery.exists()).to.equal(false);
  });

  it('reports the first line of `prey-recovery version`', (done) => {
    recovery.__set__('platform', 'darwin');
    execFileStub.callsFake((bin, args, opts, cb) => cb(null, '1.2.3\n'));
    recovery.get_prey_recovery_version((err, version) => {
      expect(err).to.equal(null);
      expect(version).to.equal('1.2.3');
      expect(execFileStub.firstCall.args[1]).to.deep.equal(['version']);
      done();
    });
  });

  it('reports null when the binary is missing or fails', (done) => {
    recovery.__set__('platform', 'darwin');
    fsStub.existsSync.returns(false);
    recovery.get_prey_recovery_version((err, version) => {
      expect(version).to.equal(null);
      fsStub.existsSync.returns(true);
      execFileStub.callsFake((bin, args, opts, cb) => cb(new Error('boom')));
      recovery.get_prey_recovery_version((err2, version2) => {
        expect(version2).to.equal(null);
        done();
      });
    });
  });
});
