/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const EventEmitter = require('events').EventEmitter;

describe('Hostname Trigger', () => {
  let hostnameRewired;
  let hooksStub;
  let loggerStub;
  let storageStub;
  let providersStub;
  let triggersStub;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    hooksStub = {
      on: sinon.stub(),
      remove: sinon.stub(),
    };

    loggerStub = {
      info: sinon.stub(),
      debug: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };

    storageStub = {
      do: sinon.stub(),
    };

    providersStub = {
      get: sinon.stub(),
    };

    triggersStub = {
      watch: sinon.stub(),
      unwatch: sinon.stub(),
    };

    hostnameRewired = rewire('../../../../../lib/agent/triggers/hostname/index');
    hostnameRewired.__set__('hooks', hooksStub);
    hostnameRewired.__set__('logger', loggerStub);
    hostnameRewired.__set__('storage', storageStub);
    hostnameRewired.__set__('providers', providersStub);
    hostnameRewired.__set__('triggers', triggersStub);

    // Reset module-level state between tests
    hostnameRewired.__set__('emitter', null);
    hostnameRewired.__set__('checking', false);
    hostnameRewired.__set__('connection_status', undefined);
    hostnameRewired.__set__('pending_data', undefined);
    hostnameRewired.__set__('poll_timer', null);
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('start — happy path', () => {
    it('should call cb with an emitter when watch succeeds', (done) => {
      const hostnameEmitter = new EventEmitter();
      triggersStub.watch.callsFake((trigger, cb) => {
        cb(null, hostnameEmitter);
      });
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.be.an.instanceof(EventEmitter);
        done();
      });

      clock.tick(1000);
    });

    it('should register state_changed listener on the hostname watcher', (done) => {
      const hostnameEmitter = new EventEmitter();
      const onSpy = sinon.spy(hostnameEmitter, 'on');
      triggersStub.watch.callsFake((trigger, cb) => {
        cb(null, hostnameEmitter);
      });
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, () => {
        expect(onSpy.calledWith('state_changed')).to.be.true;
        done();
      });

      clock.tick(1000);
    });
  });

  describe('start — watch callback error (graceful degradation)', () => {
    it('should fall back to polling when watch returns an error', (done) => {
      triggersStub.watch.callsFake((trigger, cb) => {
        cb(new Error('watcher init failed'));
      });
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.be.an.instanceof(EventEmitter);
        expect(loggerStub.warn.calledWith(sinon.match('Falling back to polling'))).to.be.true;
        done();
      });

      clock.tick(1000);
    });

    it('should start polling interval when watch callback returns an error', (done) => {
      triggersStub.watch.callsFake((trigger, cb) => {
        cb(new Error('watcher init failed'));
      });
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, () => {
        const pollTimer = hostnameRewired.__get__('poll_timer');
        expect(pollTimer).to.not.be.null;
        done();
      });

      clock.tick(1000);
    });
  });

  describe('start — synchronous spawn error (spawn UNKNOWN)', () => {
    it('should catch synchronous throw from triggers.watch and fall back to polling', (done) => {
      triggersStub.watch.throws(new Error('spawn UNKNOWN'));
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.be.an.instanceof(EventEmitter);
        expect(loggerStub.warn.calledWith(sinon.match('Failed to spawn OS trigger process'))).to.be.true;
        expect(loggerStub.warn.calledWith(sinon.match('Falling back to polling'))).to.be.true;
        done();
      });

      clock.tick(1000);
    });

    it('should not throw an unhandled exception when spawn fails', (done) => {
      triggersStub.watch.throws(new Error('spawn UNKNOWN'));
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      expect(() => {
        hostnameRewired.start({}, () => { done(); });
        clock.tick(1000);
      }).to.not.throw();
    });

    it('should set poll_timer after synchronous spawn failure', (done) => {
      triggersStub.watch.throws(new Error('spawn UNKNOWN'));
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, () => {
        const pollTimer = hostnameRewired.__get__('poll_timer');
        expect(pollTimer).to.not.be.null;
        done();
      });

      clock.tick(1000);
    });
  });

  describe('start — synchronous spawn error (spawn EPERM)', () => {
    it('should catch synchronous EPERM throw from triggers.watch and fall back to polling', (done) => {
      triggersStub.watch.throws(new Error('spawn EPERM'));
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.be.an.instanceof(EventEmitter);
        expect(loggerStub.warn.calledWith(sinon.match('Failed to spawn OS trigger process'))).to.be.true;
        expect(loggerStub.warn.calledWith(sinon.match('Falling back to polling'))).to.be.true;
        done();
      });

      clock.tick(1000);
    });

    it('should not throw an unhandled exception when spawn fails with EPERM', (done) => {
      triggersStub.watch.throws(new Error('spawn EPERM'));
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      expect(() => {
        hostnameRewired.start({}, () => { done(); });
        clock.tick(1000);
      }).to.not.throw();
    });

    it('should set poll_timer after EPERM spawn failure', (done) => {
      triggersStub.watch.throws(new Error('spawn EPERM'));
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, () => {
        const pollTimer = hostnameRewired.__get__('poll_timer');
        expect(pollTimer).to.not.be.null;
        done();
      });

      clock.tick(1000);
    });
  });

  describe('stop', () => {
    it('should clear poll_timer when polling fallback is active', (done) => {
      triggersStub.watch.throws(new Error('spawn UNKNOWN'));
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, () => {
        expect(hostnameRewired.__get__('poll_timer')).to.not.be.null;

        hostnameRewired.stop();

        expect(hostnameRewired.__get__('poll_timer')).to.be.null;
        done();
      });

      clock.tick(1000);
    });

    it('should call triggers.unwatch and remove hooks on stop', (done) => {
      const hostnameEmitter = new EventEmitter();
      triggersStub.watch.callsFake((trigger, cb) => {
        cb(null, hostnameEmitter);
      });
      providersStub.get.callsFake((name, cb) => cb(null, 'my-host'));
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, () => {
        hostnameRewired.stop();
        expect(triggersStub.unwatch.calledWith('hostname')).to.be.true;
        expect(hooksStub.remove.calledWith('connected')).to.be.true;
        expect(hooksStub.remove.calledWith('disconnected')).to.be.true;
        done();
      });

      clock.tick(1000);
    });

    it('should be safe to call stop without start', () => {
      expect(() => hostnameRewired.stop()).to.not.throw();
    });
  });

  describe('polling interval fires check_hostname', () => {
    it('should call check_hostname periodically when polling is active', (done) => {
      triggersStub.watch.throws(new Error('spawn UNKNOWN'));
      let callCount = 0;
      providersStub.get.callsFake((name, cb) => {
        callCount++;
        cb(null, 'my-host');
      });
      storageStub.do.callsFake((op, opts, cb) => cb(null, []));

      hostnameRewired.start({}, () => {
        // The initial check_hostname() Promise hasn't resolved yet (microtask),
        // so checking is still true. Reset it so the interval tick can proceed.
        hostnameRewired.__set__('checking', false);
        const initialCount = callCount;
        clock.tick(60 * 1000); // advance one POLL_INTERVAL
        expect(callCount).to.be.above(initialCount);
        done();
      });

      clock.tick(1000);
    });
  });
});
