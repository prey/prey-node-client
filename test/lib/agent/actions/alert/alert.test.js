/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const { EventEmitter } = require('events');

const { expect } = chai;

describe('alert action', () => {
  let alertRewired;
  let systemMock;
  let fakeChild;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    fakeChild = new EventEmitter();
    fakeChild.kill = sinon.stub();
    fakeChild.exitCode = null;
    fakeChild.stdout = new EventEmitter();

    systemMock = {
      spawn_as_logged_user: sinon.stub(),
      get_env: sinon.stub(),
    };

    alertRewired = rewire('../../../../../lib/agent/actions/alert');
    alertRewired.__set__('system', systemMock);
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  // ── Message validation ────────────────────────────────────────────────────

  describe('start - message validation', () => {
    it('should call cb with error if message is missing', (done) => {
      alertRewired.start('test-id', {}, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Message required');
        done();
      });
    });

    it('should call cb with error if message is an empty string', (done) => {
      alertRewired.start('test-id', { message: '   ' }, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Message required');
        done();
      });
    });

    it('should accept alert_message as an alias for message', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(null, fakeChild);
      });

      alertRewired.start('test-id', { alert_message: 'Hello' }, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.exist;
        done();
      });
    });
  });

  // ── Successful spawn ──────────────────────────────────────────────────────

  describe('start - successful spawn', () => {
    it('should return an emitter via callback on successful spawn', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(null, fakeChild);
      });

      alertRewired.start('test-id', { message: 'Hello' }, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.be.an.instanceOf(EventEmitter);
        done();
      });
    });

    it('should emit end event when the alert process exits', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(null, fakeChild);
      });

      alertRewired.start('test-id', { message: 'Hello' }, (err, emitter) => {
        emitter.on('end', (id, endErr) => {
          expect(id).to.equal('test-id');
          expect(endErr).to.be.undefined;
          done();
        });
      });

      fakeChild.emit('exit');
    });

    it('should emit end with error on child process error event', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(null, fakeChild);
      });

      alertRewired.start('test-id', { message: 'Hello' }, (err, emitter) => {
        emitter.on('end', (id, endErr) => {
          expect(id).to.equal('test-id');
          expect(endErr).to.be.an.instanceOf(Error);
          expect(endErr.message).to.equal('child error');
          done();
        });
      });

      fakeChild.emit('error', new Error('child error'));
    });

    it('should capture user input from stdout', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(null, fakeChild);
      });

      alertRewired.start('test-id', { message: 'Type something', reply: true }, (err, emitter) => {
        emitter.on('end', (id, endErr, userReply) => {
          expect(userReply).to.equal('my answer');
          done();
        });
      });

      // Emit after start() returns: trySpawn() has already run synchronously
      // (mock fires immediately), so listeners are attached to fakeChild.
      fakeChild.stdout.emit('data', 'User input: my answer');
      fakeChild.emit('exit');
    });

    it('should only call done once even if exit fires multiple times', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(null, fakeChild);
      });

      let endCount = 0;
      alertRewired.start('test-id', { message: 'Hello' }, (err, emitter) => {
        emitter.on('end', () => { endCount++; });
      });

      fakeChild.emit('exit');
      fakeChild.emit('exit');
      expect(endCount).to.equal(1);
      done();
    });
  });

  // ── Stop ──────────────────────────────────────────────────────────────────

  describe('stop', () => {
    it('should kill child process if it is running', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(null, fakeChild);
      });

      alertRewired.start('test-id', { message: 'Hello' }, () => {});

      alertRewired.stop();
      expect(fakeChild.kill.calledOnce).to.be.true;
      done();
    });

    it('should not kill child if it already exited', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        fakeChild.exitCode = 1;
        cb(null, fakeChild);
      });

      alertRewired.start('test-id', { message: 'Hello' }, () => {});

      alertRewired.stop();
      expect(fakeChild.kill.called).to.be.false;
      done();
    });

    it('should not throw if no child process exists', () => {
      expect(() => alertRewired.stop()).to.not.throw();
    });
  });

  // ── BUG FIX: These tests describe the lock-action pattern behavior.
  // The action only enters running[id] after flash.exe actually starts.
  // cb(null, emitter) is called on first successful spawn; cb(err) on hard failure;
  // NO_LOGGED_USER retries silently without calling cb at all.
  // ─────────────────────────────────────────────────────────────────────────

  describe('start - spawn failure handling [BUG FIX]', () => {
    it('should call cb with error when spawn fails with a non-retryable error', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(new Error('spawn failed'));
      });

      alertRewired.start('test-id', { message: 'Hello' }, (err, emitter) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('spawn failed');
        expect(emitter).to.be.undefined;
        done();
      });
    });

    it('should retry spawn every 5s when spawn fails with NO_LOGGED_USER', (done) => {
      const noUserErr = new Error('No logged user found.');
      noUserErr.code = 'NO_LOGGED_USER';

      let callCount = 0;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        callCount++;
        cb(noUserErr);
      });

      alertRewired.start('test-id', { message: 'Hello' }, () => {});

      expect(callCount).to.equal(1);
      clock.tick(5000);
      expect(callCount).to.equal(2);
      clock.tick(5000);
      expect(callCount).to.equal(3);
      done();
    });

    it('should not call cb during NO_LOGGED_USER retries', (done) => {
      const noUserErr = new Error('No logged user found.');
      noUserErr.code = 'NO_LOGGED_USER';

      let cbCallCount = 0;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        cb(noUserErr);
      });

      alertRewired.start('test-id', { message: 'Hello' }, () => { cbCallCount++; });

      clock.tick(10000); // advance past 2 retry intervals
      expect(cbCallCount).to.equal(0);
      done();
    });

    it('should call cb with emitter and emit end after NO_LOGGED_USER retries resolve', (done) => {
      const noUserErr = new Error('No logged user found.');
      noUserErr.code = 'NO_LOGGED_USER';

      let callCount = 0;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        callCount++;
        if (callCount < 3) return cb(noUserErr);
        cb(null, fakeChild); // succeeds on 3rd attempt
      });

      alertRewired.start('test-id', { message: 'Hello' }, (err, emitter) => {
        // cb is only called once flash.exe actually starts
        expect(err).to.be.null;
        expect(emitter).to.be.an.instanceOf(EventEmitter);

        emitter.on('end', (id, endErr) => {
          expect(id).to.equal('test-id');
          expect(endErr).to.be.undefined;
          done();
        });
      });

      clock.tick(10000); // advance past 2 retry intervals — triggers 3rd (successful) attempt
      fakeChild.emit('exit');
    });

    it('should cancel retry timer when stop() is called during retry wait', (done) => {
      const noUserErr = new Error('No logged user found.');
      noUserErr.code = 'NO_LOGGED_USER';

      let callCount = 0;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, cb) => {
        callCount++;
        cb(noUserErr);
      });

      let cbCalled = false;
      alertRewired.start('test-id', { message: 'Hello' }, () => { cbCalled = true; });

      expect(callCount).to.equal(1);
      alertRewired.stop(); // cancel before retry fires

      clock.tick(5000); // timer must NOT fire a second spawn attempt
      expect(callCount).to.equal(1);
      expect(cbCalled).to.be.false;
      done();
    });
  });
});
