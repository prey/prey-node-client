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
  let waitForProcessToStopStub;
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

    // Stub log_install's fs to avoid filesystem writes during tests
    prey_owl.__set__('fs', { appendFileSync: sinon.stub() });

    // Stub waitForProcessToStop so tests don't need to simulate pgrep
    waitForProcessToStopStub = sinon.stub().callsFake((name, timeout, cb) => cb(null));
    prey_owl.__set__('waitForProcessToStop', waitForProcessToStopStub);
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
  // Bug 2 fix: two exec branches used to run in parallel during upgrades; cb was
  // called before launchctl load completed.  Also, a missing com.prey.owl.plist
  // no longer aborts the upgrade (Bug 2b).
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

    it('serializes upgrade: launchctl unload runs before launchctl load (Bug 2 fix)', (done) => {
      const order = [];

      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        if (cmd.includes('new_owl.plist')) { order.push('check_plist'); return callback(null, 'exists'); }
        if (cmd.includes('launchctl unload')) { order.push('unload'); return callback(null, ''); }
        if (cmd.includes('launchctl') && !cmd.includes('unload')) { order.push('load'); return callback(null, ''); }
        callback(null, '');
      });

      testExistingConfigurations(() => {
        const unloadIdx = order.indexOf('unload');
        const loadIdx = order.indexOf('load');
        expect(unloadIdx).to.be.greaterThan(-1, 'launchctl unload must be called');
        expect(loadIdx).to.be.greaterThan(-1, 'launchctl load must be called');
        expect(loadIdx).to.be.greaterThan(unloadIdx, 'load must come strictly after unload');
        done();
      });
    });

    it('calls cb only after launchctl load completes, not before (Bug 2 critical check)', (done) => {
      let loadCompleted = false;

      execStub.callsFake((cmd, optsOrCb, cb) => {
        const callback = resolveCb(optsOrCb, cb);
        if (cmd.includes('new_owl.plist')) return callback(null, 'exists');
        if (cmd.includes('launchctl') && !cmd.includes('unload')) {
          // Simulate async work before calling cb
          setImmediate(() => { loadCompleted = true; callback(null, ''); });
          return;
        }
        callback(null, '');
      });

      testExistingConfigurations(() => {
        expect(loadCompleted).to.be.true;
        done();
      });
    });

    it('waitForProcessToStop is called during upgrade to wait for prey-user to exit', (done) => {
      execStub.callsFake(makeExecFake([
        ['new_owl.plist', (cb) => cb(null, 'exists')],
      ]));

      testExistingConfigurations(() => {
        expect(waitForProcessToStopStub.calledOnce).to.be.true;
        expect(waitForProcessToStopStub.args[0][0]).to.equal('prey-user');
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
