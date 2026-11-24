/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');

/**
 * Resolves the callback from a (cmd, opts, cb) or (cmd, cb) exec call.
 * All exec calls in prey_owl.js use 3-arg form, but this guard is defensive.
 */
const resolveCb = (optsOrCb, cb) => (typeof optsOrCb === 'function' ? optsOrCb : cb);

/**
 * Builds an exec stub that routes by command substring patterns.
 * The last entry whose key appears in cmd wins; unmatched commands call cb(null, '').
 *
 * @param {Array<[string, function]>} routes - pairs of [pattern, (cb) => void]
 */
const makeExecFake = (routes) => (cmd, optsOrCb, cb) => {
  const callback = resolveCb(optsOrCb, cb);
  for (const [pattern, handler] of routes) {
    if (cmd.includes(pattern)) return handler(callback);
  }
  callback(null, '');
};

describe('prey_owl', () => {
  let prey_owl;
  let execStub;
  let satanObj;
  let systemStub;
  let fsStub;
  let spawnStub;
  let childStub;
  let originalModuleLoad;

  beforeEach(() => {
    satanObj = {
      ensure_created: sinon.stub().callsFake((opts, cb) => cb(null)),
      start: sinon.stub().callsFake((key, cb) => cb(null)),
      ensure_destroyed: sinon.stub().callsFake((key, cb) => cb(null)),
    };

    originalModuleLoad = Module._load;
    Module._load = function (request, ...args) {
      if (request === 'satan') return satanObj;
      return originalModuleLoad.apply(this, arguments);
    };

    prey_owl = rewire('../../../../lib/conf/tasks/prey_owl');

    // Default exec: succeeds with empty stdout
    execStub = sinon.stub().callsFake((cmd, optsOrCb, cb) => {
      resolveCb(optsOrCb, cb)(null, '');
    });
    prey_owl.__set__('exec', execStub);

    systemStub = { get_os_version: sinon.stub().callsFake((cb) => cb(null, '12.0.0')) };
    prey_owl.__set__('system', systemStub);

    // Stub fs to avoid filesystem writes during tests (log_install, reload log fd, stat)
    fsStub = {
      appendFileSync: sinon.stub(),
      openSync: sinon.stub().returns(42),
      stat: sinon.stub().callsFake((p, cb) => cb(new Error('ENOENT'))),
    };
    prey_owl.__set__('fs', fsStub);

    // Detached reload helper: never spawn a real process
    childStub = { on: sinon.stub(), unref: sinon.stub() };
    spawnStub = sinon.stub().returns(childStub);
    prey_owl.__set__('spawn', spawnStub);
  });

  afterEach(() => {
    Module._load = originalModuleLoad;
    sinon.restore();
  });

  // ─── activeWatcher ──────────────────────────────────────────────────────────
  // Bug 1 fix: activeWatcher was silently dropping cb when create_watcher failed.
  // ────────────────────────────────────────────────────────────────────────────

  describe('activeWatcher', () => {
    let activeWatcher;

    beforeEach(() => {
      activeWatcher = prey_owl.__get__('activeWatcher');
    });

    it('calls cb(null) when copy, create_watcher and start_watcher all succeed', (done) => {
      activeWatcher((err) => {
        expect(err).to.equal(null);
        expect(satanObj.ensure_created.calledOnce).to.be.true;
        expect(satanObj.start.calledOnce).to.be.true;
        done();
      });
    });

    it('calls cb(err) when create_watcher fails — no longer silently dropped (Bug 1 fix)', (done) => {
      const createError = new Error('plist write failed');
      satanObj.ensure_created.callsFake((opts, cb) => cb(createError));

      activeWatcher((err) => {
        expect(err).to.equal(createError);
        expect(satanObj.start.called).to.be.false;
        done();
      });
    });

    it('still invokes create_watcher even when binary copy fails', (done) => {
      execStub.callsFake((cmd, optsOrCb, cb) => {
        resolveCb(optsOrCb, cb)(new Error('cp: permission denied'), '');
      });

      activeWatcher(() => {
        expect(satanObj.ensure_created.calledOnce).to.be.true;
        done();
      });
    });

    it('calls cb(err) when start_watcher fails', (done) => {
      const startError = new Error('launchctl load failed');
      satanObj.start.callsFake((key, cb) => cb(startError));

      activeWatcher((err) => {
        expect(err).to.equal(startError);
        done();
      });
    });
  });

  // ─── testExistingConfigurations ─────────────────────────────────────────────
  // The upgrade path used to run `launchctl unload/load` on a path without
  // `.plist` (exit 0 despite failing), so the running daemon kept its old binary.
  // Now it replaces the binary and restarts the daemon from a detached process.
  // A missing com.prey.owl.plist does not abort the upgrade (Bug 2b).
  // ────────────────────────────────────────────────────────────────────────────

  describe('testExistingConfigurations', () => {
    let testExistingConfigurations;
    let activeWatcherStub;

    beforeEach(() => {
      testExistingConfigurations = prey_owl.__get__('testExistingConfigurations');
      activeWatcherStub = sinon.stub().callsFake((cb) => cb(null));
      prey_owl.__set__('activeWatcher', activeWatcherStub);
    });

    it('delegates to activeWatcher when com.prey.new_owl.plist does not exist (fresh install)', (done) => {
      // Default exec returns empty stdout: file does not exist
      testExistingConfigurations((err) => {
        expect(err).to.equal(null);
        expect(activeWatcherStub.calledOnce).to.be.true;
        done();
      });
    });

    it('does NOT call activeWatcher when com.prey.new_owl.plist already exists (upgrade)', (done) => {
      execStub.callsFake(makeExecFake([
        ['new_owl.plist', (cb) => cb(null, 'exists')],
      ]));

      testExistingConfigurations(() => {
        expect(activeWatcherStub.called).to.be.false;
        done();
      });
    });

    it('never runs launchctl unload/load in-process during an upgrade', (done) => {
      const cmds = [];
      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        cmds.push(cmd);
        if (cmd.includes('new_owl.plist')) return callback(null, 'exists');
        return callback(null, '');
      });

      testExistingConfigurations(() => {
        expect(cmds.filter((c) => c.includes('launchctl'))).to.have.length(0);
        done();
      });
    });

    it('copies the binary first and only then schedules the detached daemon restart', (done) => {
      const order = [];
      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        if (cmd.includes('new_owl.plist')) return callback(null, 'exists');
        if (cmd.startsWith('/bin/cp')) order.push('copy');
        return callback(null, '');
      });
      spawnStub.callsFake(() => { order.push('spawn'); return childStub; });

      testExistingConfigurations((err) => {
        expect(err).to.equal(null);
        expect(order).to.deep.equal(['copy', 'spawn']);
        done();
      });
    });

    it('restarts the daemon via a detached kickstart, with bootstrap of the .plist as fallback', (done) => {
      execStub.callsFake(makeExecFake([
        ['new_owl.plist', (cb) => cb(null, 'exists')],
      ]));

      testExistingConfigurations(() => {
        expect(spawnStub.calledOnce).to.be.true;
        const [bin, args, opts] = spawnStub.args[0];
        expect(bin).to.equal('/bin/sh');
        expect(args[0]).to.equal('-c');
        expect(args[1]).to.include('launchctl kickstart -k system/com.prey.new_owl');
        expect(args[1]).to.include(
          'launchctl bootstrap system /Library/LaunchDaemons/com.prey.new_owl.plist',
        );
        expect(args[1]).to.match(/^sleep \d+;/);
        expect(opts.detached).to.be.true;
        expect(opts.stdio).to.deep.equal(['ignore', 42, 42]);
        expect(childStub.unref.calledOnce).to.be.true;
        done();
      });
    });

    it('calls cb(err) and does NOT restart the daemon when the copy fails', (done) => {
      const copyError = new Error('cp: permission denied');
      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        if (cmd.includes('new_owl.plist')) return callback(null, 'exists');
        if (cmd.startsWith('/bin/cp')) return callback(copyError, '');
        return callback(null, '');
      });

      testExistingConfigurations((err) => {
        expect(err).to.equal(copyError);
        expect(spawnStub.called).to.be.false;
        done();
      });
    });

    it('completes successfully when com.prey.owl.plist does not exist (Bug 2b fix)', (done) => {
      // Previously this caused an early cb(error_message) while also firing launchctl unload
      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        if (cmd.includes('new_owl.plist')) return callback(null, 'exists');
        // All other checks (old plist, copy, load) return empty / success
        callback(null, '');
      });

      testExistingConfigurations((err) => {
        expect(err).to.equal(null);
        done();
      });
    });

    it('deletes versions/prey-user before copying on macOS >= 13', (done) => {
      systemStub.get_os_version.callsFake((cb) => cb(null, '13.1.0'));
      const deleteCmds = [];

      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        if (cmd.includes('new_owl.plist')) return callback(null, 'exists');
        if (cmd.includes('rm') && cmd.includes('versions')) deleteCmds.push(cmd);
        callback(null, '');
      });

      testExistingConfigurations(() => {
        expect(deleteCmds).to.have.length(1);
        done();
      });
    });

    it('skips the delete-versions step on macOS < 13', (done) => {
      systemStub.get_os_version.callsFake((cb) => cb(null, '12.6.0'));
      const deleteCmds = [];

      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        if (cmd.includes('new_owl.plist')) return callback(null, 'exists');
        if (cmd.includes('rm') && cmd.includes('versions')) deleteCmds.push(cmd);
        callback(null, '');
      });

      testExistingConfigurations(() => {
        expect(deleteCmds).to.have.length(0);
        done();
      });
    });
  });

  // ─── scheduleDaemonReload ───────────────────────────────────────────────────

  describe('scheduleDaemonReload', () => {
    let scheduleDaemonReload;

    beforeEach(() => {
      scheduleDaemonReload = prey_owl.__get__('scheduleDaemonReload');
    });

    it('still spawns the reload with stdio ignored when the install log cannot be opened', () => {
      fsStub.openSync.throws(new Error('EACCES'));

      expect(() => scheduleDaemonReload('test')).to.not.throw();
      expect(spawnStub.calledOnce).to.be.true;
      expect(spawnStub.args[0][2].stdio).to.equal('ignore');
    });

    it('does not throw when spawn itself throws', () => {
      spawnStub.throws(new Error('EAGAIN'));

      expect(() => scheduleDaemonReload('test')).to.not.throw();
    });

    it('listens for spawn errors so an async failure cannot crash the process', () => {
      scheduleDaemonReload('test');

      expect(childStub.on.calledWith('error')).to.be.true;
    });
  });

  // ─── compareVersionsDaemon: daemon left on its previous binary ──────────────
  // An upgrade that replaced versions/prey-user without restarting the daemon
  // leaves it on the old binary forever, because every later tick sees equal
  // versions. The equal-version path now restarts a daemon older than its binary.
  // ────────────────────────────────────────────────────────────────────────────

  describe('compareVersionsDaemon (stale daemon)', () => {
    const LSTART = 'Fri Nov 20 18:51:14 2026';
    let compareVersionsDaemon;
    let psLine;

    /** @param {number} offsetMs - binary mtime relative to the daemon start */
    const binaryChangedAt = (offsetMs) => {
      const mtime = new Date(new Date(LSTART).getTime() + offsetMs);
      fsStub.stat.callsFake((p, cb) => cb(null, { mtime }));
    };

    /** @param {number} offsetMs - "now" relative to the daemon start */
    const nowAt = (offsetMs) => {
      prey_owl.__set__('now', () => new Date(LSTART).getTime() + offsetMs);
    };

    beforeEach(() => {
      compareVersionsDaemon = prey_owl.__get__('compareVersionsDaemon');
      nowAt(60 * 60 * 1000); // daemon has been up for an hour
      psLine = `${LSTART}     ${prey_owl.__get__('installVersionsPath')}`;
      execStub.callsFake(makeExecFake([
        ['/bin/ps', (cb) => cb(null, `Fri Nov 20 18:50:00 2026     /usr/sbin/cron\n${psLine}\n`)],
      ]));
    });

    it('restarts the daemon when it started before its binary was replaced', (done) => {
      binaryChangedAt(3 * 60 * 1000);

      compareVersionsDaemon('1.1.0', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(spawnStub.calledOnce).to.be.true;
        expect(spawnStub.args[0][1][1]).to.include('kickstart -k system/com.prey.new_owl');
        done();
      });
    });

    it('does nothing when the daemon started after its binary changed', (done) => {
      binaryChangedAt(-60 * 1000);

      compareVersionsDaemon('1.1.0', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(spawnStub.called).to.be.false;
        done();
      });
    });

    it('does nothing when the binary changed within the margin of the daemon start', (done) => {
      binaryChangedAt(2000);

      compareVersionsDaemon('1.1.0', '1.1.0', () => {
        expect(spawnStub.called).to.be.false;
        done();
      });
    });

    it('does nothing when the binary mtime is in the future (clock moved back) — no restart loop', (done) => {
      binaryChangedAt(25 * 60 * 60 * 1000); // a day after "now"

      compareVersionsDaemon('1.1.0', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(spawnStub.called).to.be.false;
        done();
      });
    });

    it('does not restart a daemon younger than the minimum uptime, even if stale', (done) => {
      binaryChangedAt(10 * 1000);
      nowAt(30 * 1000); // started 30 s ago, binary replaced 20 s ago

      compareVersionsDaemon('1.1.0', '1.1.0', () => {
        expect(spawnStub.called).to.be.false;
        done();
      });
    });

    it('restarts a stale daemon once it is past the minimum uptime', (done) => {
      binaryChangedAt(10 * 1000);
      nowAt(2 * 60 * 1000);

      compareVersionsDaemon('1.1.0', '1.1.0', () => {
        expect(spawnStub.calledOnce).to.be.true;
        done();
      });
    });

    it('does nothing when the daemon is not running', (done) => {
      binaryChangedAt(3 * 60 * 1000);
      execStub.callsFake(makeExecFake([
        ['/bin/ps', (cb) => cb(null, 'Fri Nov 20 18:50:00 2026     /usr/sbin/cron\n')],
      ]));

      compareVersionsDaemon('1.1.0', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(spawnStub.called).to.be.false;
        done();
      });
    });

    it('does nothing when ps fails', (done) => {
      execStub.callsFake(makeExecFake([
        ['/bin/ps', (cb) => cb(new Error('ps: not permitted'), '')],
      ]));

      compareVersionsDaemon('1.1.0', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(spawnStub.called).to.be.false;
        done();
      });
    });

    it('does nothing when the binary cannot be stat-ed', (done) => {
      // default fsStub.stat fails with ENOENT
      compareVersionsDaemon('1.1.0', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(spawnStub.called).to.be.false;
        done();
      });
    });

    it('runs the upgrade path, not the stale check, when current/bin is newer', (done) => {
      const testExistingConfigurationsStub = sinon.stub().callsFake((cb) => cb(null));
      prey_owl.__set__('testExistingConfigurations', testExistingConfigurationsStub);

      compareVersionsDaemon('1.0.11', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(testExistingConfigurationsStub.calledOnce).to.be.true;
        expect(execStub.calledWithMatch('/bin/ps')).to.be.false;
        done();
      });
    });
  });

  // ─── compareVersionsDaemon: already up to date is a success ─────────────────
  // It used to call cb('New version < old version'), so `prey config hooks
  // set_watcher` printed "Error! undefined" and exited 1 every hour on every Mac.
  // ────────────────────────────────────────────────────────────────────────────

  describe('compareVersionsDaemon (version comparison)', () => {
    let compareVersionsDaemon;
    let testExistingConfigurationsStub;

    beforeEach(() => {
      compareVersionsDaemon = prey_owl.__get__('compareVersionsDaemon');
      testExistingConfigurationsStub = sinon.stub().callsFake((cb) => cb(null));
      prey_owl.__set__('testExistingConfigurations', testExistingConfigurationsStub);
    });

    it('calls cb(null) without upgrading when the versions are equal', (done) => {
      compareVersionsDaemon('1.1.0\n', '1.1.0\n', (err) => {
        expect(err).to.equal(null);
        expect(testExistingConfigurationsStub.called).to.be.false;
        done();
      });
    });

    it('calls cb(null) without upgrading when the installed version is newer', (done) => {
      compareVersionsDaemon('1.2.0', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(testExistingConfigurationsStub.called).to.be.false;
        done();
      });
    });

    it('runs the upgrade path when the installed version is older', (done) => {
      compareVersionsDaemon('1.0.11', '1.1.0', (err) => {
        expect(err).to.equal(null);
        expect(testExistingConfigurationsStub.calledOnce).to.be.true;
        done();
      });
    });

    it('writes an "already up to date" line to the installation log', (done) => {
      compareVersionsDaemon('1.1.0\n', '1.1.0\n', () => {
        const lines = fsStub.appendFileSync.args.map((a) => a[1]);
        expect(lines.some((l) => l.includes('prey-user already up to date (1.1.0 >= 1.1.0)'))).to.be.true;
        done();
      });
    });
  });

  // ─── daemon.set_watcher → prey_owl (adapter path) ───────────────────────────
  // `prey config set_watcher` reaches prey_owl through daemon.set_watcher; this
  // exercises that path end to end with the real prey_owl module.
  // ────────────────────────────────────────────────────────────────────────────

  describe('daemon.set_watcher → prey_owl upgrade path', () => {
    it('replaces versions/prey-user and schedules the detached restart when current/bin is newer', (done) => {
      const daemon = rewire('../../../../lib/conf/tasks/daemon');
      daemon.__set__('fs', { appendFileSync: sinon.stub() });
      daemon.__set__('prey_owl', prey_owl);

      const cmds = [];
      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        cmds.push(cmd);
        if (cmd === prey_owl.cmdExistsCurrentBinPreyUser) return callback(null, 'exists');
        if (cmd === prey_owl.cmdCurrentBinPreyUserVersion) return callback(null, '1.1.0\n');
        if (cmd === prey_owl.cmdExistsInstallVersionPreyUser) return callback(null, 'exists');
        if (cmd === prey_owl.cmdInstallVersionsreyUserVersion) return callback(null, '1.0.11\n');
        if (cmd === prey_owl.existsNewPath) return callback(null, 'exists');
        return callback(null, '');
      });

      daemon.set_watcher((err) => {
        expect(err).to.equal(null);
        expect(cmds).to.include(prey_owl.copyCurrentToInstallVersionPath);
        expect(spawnStub.calledOnce).to.be.true;
        expect(spawnStub.args[0][2].detached).to.be.true;
        done();
      });
    });

    it('succeeds without copying or restarting when both prey-user binaries are the same version', (done) => {
      const daemon = rewire('../../../../lib/conf/tasks/daemon');
      daemon.__set__('fs', { appendFileSync: sinon.stub() });
      daemon.__set__('prey_owl', prey_owl);

      const cmds = [];
      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        cmds.push(cmd);
        if (cmd === prey_owl.cmdExistsCurrentBinPreyUser) return callback(null, 'exists');
        if (cmd === prey_owl.cmdCurrentBinPreyUserVersion) return callback(null, '1.1.0\n');
        if (cmd === prey_owl.cmdExistsInstallVersionPreyUser) return callback(null, 'exists');
        if (cmd === prey_owl.cmdInstallVersionsreyUserVersion) return callback(null, '1.1.0\n');
        return callback(null, '');
      });

      daemon.set_watcher((err) => {
        expect(err).to.equal(null);
        expect(cmds).to.not.include(prey_owl.copyCurrentToInstallVersionPath);
        expect(spawnStub.called).to.be.false;
        done();
      });
    });
  });

  // ─── trigger_set_watcher ────────────────────────────────────────────────────
  // Bug 3 fix: when prey-user binary was not found in current/bin, the Node.js
  // exec Error (shell exit code 1) was passed to cb as a fatal error.  Now it
  // falls back to testExistingConfigurations instead.
  // ────────────────────────────────────────────────────────────────────────────

  describe('trigger_set_watcher', () => {
    let testExistingConfigurationsStub;

    beforeEach(() => {
      testExistingConfigurationsStub = sinon.stub().callsFake((cb) => cb(null));
      prey_owl.__set__('testExistingConfigurations', testExistingConfigurationsStub);
    });

    it('falls back to testExistingConfigurations when prey-user not found — not fatal (Bug 3 fix)', (done) => {
      // Shell exits with error + empty stdout when test -f fails
      execStub.callsFake((cmd, optsOrCb, cb) => {
        resolveCb(optsOrCb, cb)(new Error('exit code 1'), '');
      });

      prey_owl.trigger_set_watcher((err) => {
        expect(err).to.equal(null);
        expect(testExistingConfigurationsStub.calledOnce).to.be.true;
        done();
      });
    });

    it('does not propagate the shell exit-code error to cb (Bug 3 fix)', (done) => {
      const shellError = new Error('exit code 1');
      execStub.callsFake((cmd, optsOrCb, cb) => {
        resolveCb(optsOrCb, cb)(shellError, '');
      });

      prey_owl.trigger_set_watcher((err) => {
        expect(err).to.not.equal(shellError);
        done();
      });
    });

    it('reads the prey-user version and proceeds to getPreyUserVersions when binary exists', (done) => {
      let versionCheckCalled = false;
      let callIndex = 0;

      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        callIndex += 1;
        // Call 1: exists check → binary found
        if (callIndex === 1) return callback(null, 'exists');
        // Call 2: version command
        if (callIndex === 2) { versionCheckCalled = true; return callback(null, '1.0.5\n'); }
        // Remaining calls (version checks for installed binary): not found → triggers testExistingConfigurations
        callback(null, '');
      });

      prey_owl.trigger_set_watcher(() => {
        expect(versionCheckCalled).to.be.true;
        expect(testExistingConfigurationsStub.calledOnce).to.be.true;
        done();
      });
    });

    it('calls cb(err) when the prey-user version command itself fails', (done) => {
      const versionError = new Error('binary not executable');
      let callIndex = 0;

      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        callIndex += 1;
        if (callIndex === 1) return callback(null, 'exists');  // binary found
        return callback(versionError, '');                      // version command fails
      });

      prey_owl.trigger_set_watcher((err) => {
        expect(err).to.equal(versionError);
        done();
      });
    });
  });

  // ─── exports.create_watcher / exports.start_watcher ─────────────────────────

  describe('create_watcher', () => {
    it('calls satan.ensure_created and calls cb(null) on success', (done) => {
      prey_owl.create_watcher((err) => {
        expect(err).to.equal(null);
        expect(satanObj.ensure_created.calledOnce).to.be.true;
        done();
      });
    });

    it('propagates satan.ensure_created errors to cb', (done) => {
      const satanError = new Error('plist error');
      satanObj.ensure_created.callsFake((opts, cb) => cb(satanError));

      prey_owl.create_watcher((err) => {
        expect(err).to.equal(satanError);
        done();
      });
    });
  });

  describe('start_watcher', () => {
    it('calls satan.start with the new watcher key and propagates result', (done) => {
      prey_owl.start_watcher((err) => {
        expect(err).to.equal(null);
        expect(satanObj.start.calledOnce).to.be.true;
        expect(satanObj.start.args[0][0]).to.equal('com.prey.new_owl');
        done();
      });
    });
  });
});
