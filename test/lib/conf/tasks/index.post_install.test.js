/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');

describe('tasks.post_install orchestration', () => {
  let tasks;
  let preyUserCreateStub;
  let daemonInstallStub;
  let daemonSetWatcherStub;
  let osHooksPostInstallStub;
  let clearFoldersStartStub;
  let clearFilesTempStartStub;
  let originalModuleLoad;

  beforeEach(() => {
    originalModuleLoad = Module._load;
    Module._load = function (request, ...args) {
      if (request === 'firewall') return { remove_rule: () => {} };
      return originalModuleLoad.apply(this, arguments);
    };

    tasks = rewire('../../../../lib/conf/tasks/index');

    preyUserCreateStub = sinon.stub().callsFake((cb) => cb(null));
    daemonInstallStub = sinon.stub().callsFake((cb) => cb(null));
    daemonSetWatcherStub = sinon.stub().callsFake((cb) => cb(null));
    osHooksPostInstallStub = sinon.stub().callsFake((cb) => cb(null));
    clearFoldersStartStub = sinon.stub().callsFake((cb) => cb(null));
    clearFilesTempStartStub = sinon.stub().callsFake((cb) => cb(null));

    tasks.__set__('prey_user', { create: preyUserCreateStub });
    tasks.__set__('daemon', {
      install: daemonInstallStub,
      set_watcher: daemonSetWatcherStub,
      remove: sinon.stub().callsFake((cb) => cb()),
    });
    tasks.__set__('osHooks', {
      post_install: osHooksPostInstallStub,
      pre_uninstall: sinon.stub().callsFake((cb) => cb()),
    });
    tasks.__set__('clear_folders', { start: clearFoldersStartStub });
    tasks.__set__('clear_files_temp', { start: clearFilesTempStartStub });
    tasks.__set__('fs', {
      appendFileSync: sinon.stub(),
      existsSync: sinon.stub().returns(true),
      mkdir: sinon.stub().callsFake((dir, cb) => cb()),
    });
    // Stub setUpVersion (Windows-only branch) so it doesn't invoke ready
    tasks.__set__('setUpVersion', sinon.stub());
  });

  afterEach(() => {
    Module._load = originalModuleLoad;
    sinon.restore();
  });

  // ─── non-mac path ───────────────────────────────────────────────────────────

  describe('non-mac (is_mac = false)', () => {
    beforeEach(() => {
      tasks.__set__('is_mac', false);
    });

    it('calls prey_user.create before running the task series', (done) => {
      tasks.post_install({}, () => {
        expect(preyUserCreateStub.calledOnce).to.be.true;
        done();
      });
    });

    it('propagates prey_user.create errors to cb — task series never runs', (done) => {
      const createErr = new Error('guest account creation failed');
      preyUserCreateStub.callsFake((cb) => cb(createErr));

      tasks.post_install({}, (err) => {
        expect(err).to.equal(createErr);
        expect(daemonInstallStub.called).to.be.false;
        done();
      });
    });

    it('runs all 4 tasks in the expected order', (done) => {
      const order = [];
      daemonInstallStub.callsFake((cb) => { order.push('daemon.install'); cb(null); });
      osHooksPostInstallStub.callsFake((cb) => { order.push('osHooks.post_install'); cb(null); });
      clearFoldersStartStub.callsFake((cb) => { order.push('clear_folders'); cb(null); });
      clearFilesTempStartStub.callsFake((cb) => { order.push('clear_files_temp'); cb(null); });

      tasks.post_install({}, () => {
        expect(order).to.deep.equal([
          'daemon.install',
          'osHooks.post_install',
          'clear_folders',
          'clear_files_temp',
        ]);
        done();
      });
    });

    it('calls cb(err) and stops the series when daemon.install fails', (done) => {
      const installErr = new Error('daemon install failed');
      daemonInstallStub.callsFake((cb) => cb(installErr));

      tasks.post_install({}, (err) => {
        expect(err).to.equal(installErr);
        expect(osHooksPostInstallStub.called).to.be.false;
        expect(clearFoldersStartStub.called).to.be.false;
        done();
      });
    });

    it('calls cb(err) and stops the series when osHooks.post_install fails', (done) => {
      const hooksErr = new Error('osHooks failed');
      osHooksPostInstallStub.callsFake((cb) => cb(hooksErr));

      tasks.post_install({}, (err) => {
        expect(err).to.equal(hooksErr);
        expect(clearFoldersStartStub.called).to.be.false;
        done();
      });
    });

    it('does NOT call daemon.set_watcher on non-mac', (done) => {
      tasks.post_install({}, () => {
        expect(daemonSetWatcherStub.called).to.be.false;
        done();
      });
    });

    it('calls cb() with no arguments on full success', (done) => {
      tasks.post_install({}, (err) => {
        expect(err).to.be.undefined;
        done();
      });
    });
  });

  // ─── mac path ───────────────────────────────────────────────────────────────

  describe('mac (is_mac = true)', () => {
    beforeEach(() => {
      tasks.__set__('is_mac', true);
    });

    it('calls daemon.set_watcher after all 4 tasks complete', (done) => {
      const order = [];
      daemonInstallStub.callsFake((cb) => { order.push('install'); cb(null); });
      osHooksPostInstallStub.callsFake((cb) => { order.push('osHooks'); cb(null); });
      clearFoldersStartStub.callsFake((cb) => { order.push('folders'); cb(null); });
      clearFilesTempStartStub.callsFake((cb) => { order.push('files_temp'); cb(null); });
      daemonSetWatcherStub.callsFake((cb) => { order.push('set_watcher'); cb(null); });

      tasks.post_install({}, () => {
        expect(order).to.deep.equal([
          'install',
          'osHooks',
          'folders',
          'files_temp',
          'set_watcher',
        ]);
        done();
      });
    });

    it('calls cb() even when daemon.set_watcher returns an error — watcher error is non-fatal', (done) => {
      const watcherErr = new Error('watcher setup failed');
      daemonSetWatcherStub.callsFake((cb) => cb(watcherErr));

      tasks.post_install({}, (err) => {
        // finished() always calls cb() regardless of watcherErr
        expect(err).to.be.undefined;
        done();
      });
    });

    it('does NOT call daemon.set_watcher when the task series fails', (done) => {
      daemonInstallStub.callsFake((cb) => cb(new Error('install failed')));

      tasks.post_install({}, () => {
        expect(daemonSetWatcherStub.called).to.be.false;
        done();
      });
    });

    it('calls daemon.set_watcher exactly once on success', (done) => {
      tasks.post_install({}, () => {
        expect(daemonSetWatcherStub.calledOnce).to.be.true;
        done();
      });
    });
  });
});
