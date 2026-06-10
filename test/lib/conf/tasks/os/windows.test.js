/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');

describe('Windows uninstall hooks', () => {
  let windowsHooks;
  let execStub;
  let readFileStub;
  let existsSyncStub;
  let rmStub;
  let readdirStub;
  let deleteNodeServiceStub;
  let logStub;
  let winsvcStub;
  let originalModuleLoad;

  beforeEach(() => {
    originalModuleLoad = Module._load;
    Module._load = function (request, ...args) {
      if (request === 'firewall') return { remove_rule: () => {} };
      return originalModuleLoad.apply(this, arguments);
    };

    windowsHooks = rewire('../../../../../lib/conf/tasks/os/windows');

    execStub = sinon.stub();
    readFileStub = sinon.stub();
    existsSyncStub = sinon.stub();
    rmStub = sinon.stub();
    readdirStub = sinon.stub().callsFake((dir, cb) => cb(null, []));
    deleteNodeServiceStub = sinon.stub();
    logStub = sinon.stub();

    windowsHooks.__set__('exec', execStub);
    windowsHooks.__set__('fs', {
      readFile: readFileStub,
      existsSync: existsSyncStub,
      rm: rmStub,
      readdir: readdirStub,
    });
    windowsHooks.__set__('deleteNodeService', deleteNodeServiceStub);
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
      package: String.raw`C:\Windows\Prey\versions\1.13.30`,
    });

    // Default: winsvc not supported — forces all old (fallback) paths
    winsvcStub = {
      get_bin: () => String.raw`C:\Windows\Prey\current\lib\system\windows\bin\wpxsvc.exe`,
      supports: sinon.stub().callsFake((v, cb) => cb(false)),
      http_action: sinon.stub().callsFake((action, opts, cb) => cb(null)),
    };
    windowsHooks.__set__('winsvc', winsvcStub);
  });

  afterEach(() => {
    Module._load = originalModuleLoad;
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
      expect(commands).to.not.include('taskkill /f /im wpxsvc.exe');
      expect(commands.some((cmd) => cmd.includes('Remove-NetFirewallRule'))).to.equal(true);
      expect(commands.some((cmd) => cmd.includes('Stop-Process'))).to.equal(false);
      expect(deleteNodeServiceStub.calledOnce).to.equal(true);
      done();
    });
  });

  it('adds firewall rule via PowerShell in post_activate', (done) => {
    execStub.callsFake((cmd, cb) => cb(null, '', ''));

    windowsHooks.post_activate(() => {
      const commands = execStub.getCalls().map((call) => call.args[0]);

      expect(commands.some((cmd) => cmd.includes('Remove-NetFirewallRule'))).to.equal(true);
      expect(commands.some((cmd) => cmd.includes('New-NetFirewallRule'))).to.equal(true);
      expect(commands.some((cmd) => cmd.includes('Prey.Agent'))).to.equal(true);
      done();
    });
  });

  describe('with winsvc >= 2.0.34', () => {
    let httpActionStub;

    beforeEach(() => {
      httpActionStub = sinon.stub().callsFake((action, opts, cb) => cb(null));
      windowsHooks.__set__('winsvc', {
        get_bin: () => String.raw`C:\Windows\Prey\current\lib\system\windows\bin\wpxsvc.exe`,
        supports: sinon.stub().callsFake((v, cb) => cb(true)),
        http_action: httpActionStub,
      });
    });

    it('uses winsvc HTTP for firewall in post_activate when service is running', (done) => {
      execStub.callsFake((cmd, cb) => cb(null, '', ''));

      windowsHooks.post_activate(() => {
        const commands = execStub.getCalls().map((c) => c.args[0]);
        expect(commands.some((cmd) => cmd.includes('New-NetFirewallRule'))).to.equal(false);
        expect(commands.some((cmd) => cmd.includes('Remove-NetFirewallRule'))).to.equal(false);
        // action is 1st arg, opts is 2nd arg
        const opts = httpActionStub.getCalls()
          .filter((c) => c.args[0] === 'firewall-rule')
          .map((c) => c.args[1]);
        expect(opts.some((o) => o.operation === 'remove')).to.equal(true);
        expect(opts.some((o) => o.operation === 'add')).to.equal(true);
        done();
      });
    });

    it('falls back to CLI in post_activate when winsvc HTTP is unavailable', (done) => {
      httpActionStub.callsFake((action, opts, cb) => cb(new Error('ECONNREFUSED')));
      execStub.callsFake((cmd, cb) => cb(null, '', ''));

      windowsHooks.post_activate(() => {
        const commands = execStub.getCalls().map((c) => c.args[0]);
        expect(commands.some((cmd) => cmd.includes('-firewall=remove'))).to.equal(true);
        expect(commands.some((cmd) => cmd.includes('-firewall=add'))).to.equal(true);
        expect(commands.some((cmd) => cmd.includes('New-NetFirewallRule'))).to.equal(false);
        done();
      });
    });

    it('falls back to PowerShell in post_activate when winsvc HTTP and CLI both fail', (done) => {
      httpActionStub.callsFake((action, opts, cb) => cb(new Error('timeout')));
      execStub.callsFake((cmd, cb) => {
        if (cmd.includes('-firewall=')) return cb(new Error('Access denied'));
        cb(null, '', '');
      });

      windowsHooks.post_activate(() => {
        const commands = execStub.getCalls().map((c) => c.args[0]);
        expect(commands.some((cmd) => cmd.includes('Remove-NetFirewallRule'))).to.equal(true);
        expect(commands.some((cmd) => cmd.includes('New-NetFirewallRule'))).to.equal(true);
        done();
      });
    });

    it('uses winsvc HTTP for firewall in pre_uninstall, sc.exe for service control', (done) => {
      execStub.callsFake((cmd, cb) => cb(null, '', ''));
      readFileStub.callsFake((file, cb) => cb(new Error('missing pidfile')));

      windowsHooks.pre_uninstall(() => {
        const commands = execStub.getCalls().map((c) => c.args[0]);
        expect(commands.some((cmd) => cmd.includes('Remove-NetFirewallRule'))).to.equal(false);
        expect(commands).to.include('sc.exe config CronService start= disabled');
        expect(commands).to.include('sc.exe stop CronService');
        expect(commands).to.include('sc.exe delete CronService');
        expect(commands).to.not.include('taskkill /f /im wpxsvc.exe');
        done();
      });
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
      expect(commands.some((cmd) => cmd.includes('Remove-Item'))).to.equal(false);
      expect(removedDirs).to.include(String.raw`C:\Windows\Prey`);
      done();
    });
  });
});
