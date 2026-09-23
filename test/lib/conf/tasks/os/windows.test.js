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

    // exec is now called as exec(cmd, opts, cb). Normalize to (cmd, cb) so existing
    // stubs and getCalls().args[0] assertions keep working unchanged.
    windowsHooks.__set__('exec', (cmd, opts, cb) => {
      const done = typeof opts === 'function' ? opts : cb;
      return execStub(cmd, done);
    });
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

  it('tolerates a synchronous spawn throw (EROFS) while removing the firewall rule', (done) => {
    // remove throws synchronously (best-effort) but add succeeds -> post_activate OK
    execStub.callsFake((cmd, cb) => {
      if (cmd.includes('Remove-NetFirewallRule')) throw new Error('spawn EROFS');
      cb(null, '', '');
    });

    windowsHooks.post_activate((err) => {
      expect(err == null).to.equal(true);
      const commands = execStub.getCalls().map((c) => c.args[0]);
      expect(commands.some((cmd) => cmd.includes('New-NetFirewallRule'))).to.equal(true);
      done();
    });
  });

  it('completes post_activate without error when adding the firewall rule fails (EROFS)', (done) => {
    // add throws synchronously on its only (PowerShell) attempt -> best-effort:
    // the failure is logged and activation still succeeds.
    execStub.callsFake((cmd, cb) => {
      if (cmd.includes('New-NetFirewallRule')) throw new Error('spawn EROFS');
      cb(null, '', '');
    });

    windowsHooks.post_activate((err) => {
      expect(err == null).to.equal(true);
      const commands = execStub.getCalls().map((c) => c.args[0]);
      expect(commands.some((cmd) => cmd.includes('New-NetFirewallRule'))).to.equal(true);
      const logs = logStub.getCalls().map((c) => c.args[0]);
      expect(logs.some((msg) => /continuing anyway/.test(msg))).to.equal(true);
      done();
    });
  });

  it('does not propagate an error from post_activate when the firewall rule is added', (done) => {
    execStub.callsFake((cmd, cb) => cb(null, '', ''));

    windowsHooks.post_activate((err) => {
      expect(err == null).to.equal(true);
      done();
    });
  });

  it('spawns firewall commands with a safe cwd (Windows Temp)', (done) => {
    const optsSpy = sinon.stub();
    windowsHooks.__set__('exec', (cmd, opts, cb) => {
      const done2 = typeof opts === 'function' ? opts : cb;
      optsSpy(cmd, typeof opts === 'function' ? undefined : opts);
      return done2(null, '', '');
    });

    windowsHooks.post_activate(() => {
      const safeCwd = windowsHooks.__get__('SAFE_CWD');
      const fwCalls = optsSpy.getCalls().filter((c) => /NetFirewallRule/.test(c.args[0]));
      expect(fwCalls.length).to.be.greaterThan(0);
      fwCalls.forEach((c) => {
        expect(c.args[1]).to.be.an('object');
        expect(c.args[1].cwd).to.equal(safeCwd);
      });
      expect(safeCwd.endsWith('Temp')).to.equal(true);
      done();
    });
  });

  it('completes post_activate without error when winsvc, CLI and PowerShell all fail', (done) => {
    const httpActionStub = sinon.stub().callsFake((action, opts, cb) => cb(new Error('timeout')));
    windowsHooks.__set__('winsvc', {
      get_bin: () => String.raw`C:\Windows\Prey\current\lib\system\windows\bin\wpxsvc.exe`,
      supports: sinon.stub().callsFake((v, cb) => cb(true)),
      http_action: httpActionStub,
    });
    execStub.callsFake((cmd, cb) => {
      if (cmd.includes('New-NetFirewallRule')) throw new Error('spawn EROFS');
      if (cmd.includes('-firewall=add')) cb(new Error('Access denied'));
      else cb(null, '', '');
    });

    windowsHooks.post_activate((err) => {
      expect(err == null).to.equal(true);
      // all three fallbacks were attempted before giving up
      expect(httpActionStub.getCalls().some((c) => c.args[0] === 'firewall-rule'
        && c.args[1].operation === 'add')).to.equal(true);
      const commands = execStub.getCalls().map((c) => c.args[0]);
      expect(commands.some((cmd) => cmd.includes('-firewall=add'))).to.equal(true);
      expect(commands.some((cmd) => cmd.includes('New-NetFirewallRule'))).to.equal(true);
      const logs = logStub.getCalls().map((c) => c.args[0]);
      expect(logs.some((msg) => /continuing anyway/.test(msg))).to.equal(true);
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
      expect(commands.some((cmd) => cmd.includes('Remove-Item'))).to.equal(false);
      expect(removedDirs).to.include(String.raw`C:\Windows\Prey`);
      done();
    });
  });
});
