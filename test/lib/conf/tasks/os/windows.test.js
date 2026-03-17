/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('Windows uninstall hooks', () => {
  let windowsHooks;
  let execStub;
  let readFileStub;
  let existsSyncStub;
  let rmStub;
  let deleteNodeServiceStub;
  let firewallRemoveStub;
  let logStub;

  beforeEach(() => {
    windowsHooks = rewire('../../../../../lib/conf/tasks/os/windows');

    execStub = sinon.stub();
    readFileStub = sinon.stub();
    existsSyncStub = sinon.stub();
    rmStub = sinon.stub();
    deleteNodeServiceStub = sinon.stub();
    firewallRemoveStub = sinon.stub();
    logStub = sinon.stub();

    windowsHooks.__set__('exec', execStub);
    windowsHooks.__set__('fs', {
      readFile: readFileStub,
      existsSync: existsSyncStub,
      rm: rmStub,
    });
    windowsHooks.__set__('deleteNodeService', deleteNodeServiceStub);
    windowsHooks.__set__('firewall', {
      remove_rule: firewallRemoveStub,
    });
    windowsHooks.__set__('shared', {
      log: logStub,
      version_manager: {
        list: sinon.stub().returns([]),
      },
    });
    windowsHooks.__set__('setTimeout', (fn) => fn());
    windowsHooks.__set__('paths', {
      temp: String.raw`C:\Windows\Temp`,
      install: String.raw`C:\Windows\Prey`,
      versions: String.raw`C:\Windows\Prey\versions`,
      current: String.raw`C:\Windows\Prey\current`,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('runs hard-stop service and process cleanup in pre_uninstall', (done) => {
    execStub.callsFake((cmd, cb) => cb(null, '', ''));
    readFileStub.callsFake((file, cb) => cb(new Error('missing pidfile')));

    windowsHooks.pre_uninstall(() => {
      const commands = execStub.getCalls().map((call) => call.args[0]);

      expect(commands).to.include('sc.exe config CronService start= disabled');
      expect(commands).to.include('sc.exe stop CronService');
      expect(commands).to.include('sc.exe delete CronService');
      expect(commands).to.include('taskkill /f /im wpxsvc.exe');
      expect(commands.some((cmd) => cmd.includes('Stop-Process -Name $_ -Force'))).to.equal(true);
      expect(deleteNodeServiceStub.calledOnce).to.equal(true);
      done();
    });
  });

  it('runs deep_cleanup for directories, temp and registry keys', (done) => {
    process.env.WINDIR = String.raw`C:\Windows`;

    execStub.callsFake((cmd, cb) => {
      if (cmd.includes(String.raw`reg query "HKLM\SOFTWARE\Prey" /v INSTALLDIR`)) {
        return cb(null, 'INSTALLDIR    REG_SZ    C:\\Program Files\\Prey\\Client\\current\\..\\..\\', '');
      }
      return cb(null, '', '');
    });

    existsSyncStub.returns(true);
    rmStub.callsFake((target, opts, cb) => cb());

    windowsHooks.deep_cleanup(() => {
      const commands = execStub.getCalls().map((call) => call.args[0]);
      const removedDirs = rmStub.getCalls().map((call) => call.args[0]);

      expect(commands).to.include(String.raw`reg delete "HKLM\SOFTWARE\Prey" /f`);
      expect(commands).to.include(String.raw`reg delete "HKCU\Software\Prey" /f`);
      expect(commands.some((cmd) => cmd.includes('Remove-Item'))).to.equal(true);
      expect(removedDirs).to.include(String.raw`C:\Windows\Prey`);
      done();
    });
  });
});
