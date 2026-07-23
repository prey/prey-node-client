/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const Module = require('module');

describe('daemon', () => {
  let daemon;
  let satanObj;
  let fsStub;
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

    daemon = rewire('../../../../lib/conf/tasks/daemon');

    fsStub = {
      appendFileSync: sinon.stub(),
      copyFile: sinon.stub().callsFake((src, dst, cb) => cb(null)),
    };
    daemon.__set__('fs', fsStub);

    // Default to non-Windows so the mac/linux path runs
    daemon.__set__('is_windows', false);
  });

  afterEach(() => {
    Module._load = originalModuleLoad;
    sinon.restore();
  });

  // ─── install (mac / non-Windows path) ────────────────────────────────────────

  describe('install (non-Windows)', () => {
    it('calls satan.ensure_created with daemon options', (done) => {
      daemon.install((err) => {
        expect(err).to.equal(null);
        expect(satanObj.ensure_created.calledOnce).to.be.true;
        done();
      });
    });

    it('calls satan.start after ensure_created succeeds', (done) => {
      daemon.install((err) => {
        expect(err).to.equal(null);
        expect(satanObj.start.calledOnce).to.be.true;
        done();
      });
    });

    it('calls satan.start only after ensure_created completes', (done) => {
      const clock = sinon.useFakeTimers();

      daemon.install((err) => {
        expect(err).to.equal(null);
        expect(satanObj.start.calledOnce).to.be.true;
        clock.restore();
        done();
      });

      // ensure_created has already called its cb; start waits 500ms
      expect(satanObj.start.called).to.be.false;
      clock.tick(500);
    });

    it('propagates satan.ensure_created errors to cb — start is NOT called', (done) => {
      const ensureErr = new Error('plist create failed');
      satanObj.ensure_created.callsFake((opts, cb) => cb(ensureErr));

      daemon.install((err) => {
        expect(err).to.equal(ensureErr);
        expect(satanObj.start.called).to.be.false;
        done();
      });
    });

    it('propagates satan.start errors to cb', (done) => {
      const startErr = new Error('launchctl load failed');
      satanObj.start.callsFake((key, cb) => cb(startErr));

      daemon.install((err) => {
        expect(err).to.equal(startErr);
        done();
      });
    });
  });

  // ─── install (Windows path) ──────────────────────────────────────────────────

  describe('install (Windows)', () => {
    let execStub;
    let systemStub;

    beforeEach(() => {
      daemon.__set__('is_windows', true);

      execStub = sinon.stub().callsFake((cmd, cb) => cb(null, ''));
      daemon.__set__('run', execStub);

      systemStub = { get_os_version: sinon.stub().callsFake((cb) => cb(null, '10.0.0')) };
      daemon.__set__('system', systemStub);
    });

    it('calls fs.copyFile before satan.ensure_created', (done) => {
      const order = [];
      fsStub.copyFile.callsFake((src, dst, cb) => { order.push('copyFile'); cb(null); });
      satanObj.ensure_created.callsFake((opts, cb) => { order.push('ensure_created'); cb(null); });

      daemon.install((err) => {
        expect(err).to.equal(null);
        expect(order[0]).to.equal('copyFile');
        expect(order[1]).to.equal('ensure_created');
        done();
      });
    });

    it('calls satan.ensure_created and start on success', (done) => {
      daemon.install((err) => {
        expect(err).to.equal(null);
        expect(satanObj.ensure_created.calledOnce).to.be.true;
        expect(satanObj.start.calledOnce).to.be.true;
        done();
      });
    });

    it('ignores EBUSY errors from fs.copyFile — install proceeds', (done) => {
      const ebusyErr = new Error('EBUSY: resource busy');
      ebusyErr.code = 'EBUSY';
      fsStub.copyFile.callsFake((src, dst, cb) => cb(ebusyErr));

      daemon.install((err) => {
        expect(err).to.equal(null);
        expect(satanObj.ensure_created.calledOnce).to.be.true;
        done();
      });
    });

    it('propagates non-EBUSY copyFile errors to cb', (done) => {
      const permErr = new Error('EACCES: permission denied');
      permErr.code = 'EACCES';
      fsStub.copyFile.callsFake((src, dst, cb) => cb(permErr));

      daemon.install((err) => {
        expect(err).to.equal(permErr);
        expect(satanObj.ensure_created.called).to.be.false;
        done();
      });
    });
  });

  // ─── set_watcher ─────────────────────────────────────────────────────────────

  describe('set_watcher', () => {
    let preyOwlStub;
    let sharedStub;

    beforeEach(() => {
      preyOwlStub = { trigger_set_watcher: sinon.stub().callsFake((cb) => cb(null)) };
      sharedStub = { log: sinon.stub() };
      daemon.__set__('prey_owl', preyOwlStub);
      daemon.__set__('shared', sharedStub);
    });

    it('delegates to prey_owl.trigger_set_watcher with the provided callback', (done) => {
      daemon.set_watcher((err) => {
        expect(err).to.equal(null);
        expect(preyOwlStub.trigger_set_watcher.calledOnce).to.be.true;
        done();
      });
    });

    it('uses a built-in default callback when none is provided — does not throw', () => {
      expect(() => daemon.set_watcher()).to.not.throw();
      expect(preyOwlStub.trigger_set_watcher.calledOnce).to.be.true;
    });

    it('the default callback handles trigger_set_watcher errors without crashing', () => {
      preyOwlStub.trigger_set_watcher.callsFake((cb) => cb(new Error('watcher failed')));

      expect(() => daemon.set_watcher()).to.not.throw();
    });
  });

  // ─── remove ──────────────────────────────────────────────────────────────────

  describe('remove (non-Windows)', () => {
    it('calls satan.ensure_destroyed and calls cb(null) on success', (done) => {
      daemon.remove((err) => {
        expect(err).to.equal(null);
        expect(satanObj.ensure_destroyed.calledOnce).to.be.true;
        done();
      });
    });

    it('propagates satan.ensure_destroyed errors to cb', (done) => {
      const destroyErr = new Error('ensure_destroyed failed');
      satanObj.ensure_destroyed.callsFake((key, cb) => cb(destroyErr));

      daemon.remove((err) => {
        expect(err).to.equal(destroyErr);
        done();
      });
    });
  });

  describe('remove (Windows)', () => {
    beforeEach(() => {
      daemon.__set__('is_windows', true);
    });

    it('calls fs.unlink after ensure_destroyed succeeds', (done) => {
      fsStub.unlink = sinon.stub().callsFake((path, cb) => cb(null));
      daemon.__set__('fs', fsStub);

      daemon.remove((err) => {
        expect(err).to.not.exist;
        expect(satanObj.ensure_destroyed.calledOnce).to.be.true;
        expect(fsStub.unlink.calledOnce).to.be.true;
        done();
      });
    });

    it('calls cb() without error even when fs.unlink fails — missing file is tolerated', (done) => {
      fsStub.unlink = sinon.stub().callsFake((path, cb) => cb(new Error('ENOENT')));
      daemon.__set__('fs', fsStub);

      daemon.remove((err) => {
        expect(err).to.not.exist;
        done();
      });
    });
  });
});
