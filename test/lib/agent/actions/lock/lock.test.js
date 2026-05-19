/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const { EventEmitter } = require('events');

const { expect } = chai;

describe('lock action', () => {
  let lockRewired;
  let systemMock;
  let clock;

  function makeFakeChild(username) {
    const ch = new EventEmitter();
    ch.kill = sinon.stub();
    ch.stdout = new EventEmitter();
    ch.impersonating = username || null;
    ch.pid = 12345;
    return ch;
  }

  function resolveSpawnCallback(opts, cb) {
    return typeof opts === 'function' ? opts : cb;
  }

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    systemMock = {
      spawn_as_logged_user: sinon.stub(),
      spawn_as_admin_user: sinon.stub(),
      run_as_logged_user: sinon.stub(),
      kill_as_logged_user: sinon.stub(),
      get_logged_user: sinon.stub(),
      paths: { current: '/fake/path' },
    };

    lockRewired = rewire('../../../../../lib/agent/actions/lock/index');
    lockRewired.__set__('system', systemMock);
    lockRewired.__set__('exec', sinon.stub().callsFake((cmd, opts, cb) => {
      if (typeof opts === 'function') cb = opts;
      if (typeof cb === 'function') cb(null, '');
    }));
    lockRewired.__set__('run_as_user', (cmd, args, cb) => { if (cb) cb(null); });
    lockRewired.__set__('is_win', true);
    lockRewired.__set__('is_mac', false);
    lockRewired.__set__('is_linux', false);
    lockRewired.__set__('after', (cb) => cb());
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  // ─── start — basic ─────────────────────────────────────────────────────────

  describe('start — basic', () => {
    it('returns an emitter via callback on successful spawn', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, makeFakeChild('primaryuser'));
      });

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.be.an.instanceOf(EventEmitter);
        done();
      });
    });

    it('calls cb with error when spawn fails with a non-retryable error', (done) => {
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(new Error('spawn failed'));
      });

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err) => {
        expect(err).to.be.an.instanceOf(Error);
        done();
      });
    });

    it('retries every 5 s on NO_LOGGED_USER until a user is found', (done) => {
      let callCount = 0;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        const callback = resolveSpawnCallback(opts, cb);
        callCount++;
        if (callCount < 3) {
          const err = new Error('No logged user');
          err.code = 'NO_LOGGED_USER';
          callback(err);
        } else {
          callback(null, makeFakeChild('primaryuser'));
        }
      });

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
        expect(callCount).to.equal(3);
        expect(emitter).to.exist;
        done();
      });

      clock.tick(5000);
      clock.tick(5000);
    });

    it('emits failed_unlock_attempt when lock stdout reports invalid password', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
        emitter.on('failed_unlock_attempt', () => done());
        fakeChild.stdout.emit('data', 'invalid password entered');
      });
    });

    it('emits end event when primary lock exits with code 66 (unlocked)', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
        emitter.on('end', (id) => {
          expect(id).to.equal('test-id');
          done();
        });
        fakeChild.emit('exit', 66);
      });
    });
  });

  // ─── stop — basic ──────────────────────────────────────────────────────────

  describe('stop — basic', () => {
    it('kills the primary child when stop is called', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        lockRewired.stop();
        expect(fakeChild.kill.calledOnce).to.be.true;
        done();
      });
    });

    it('does not throw when no active lock exists', () => {
      expect(() => lockRewired.stop()).to.not.throw();
    });
  });

  // ─── poll_sessions — Windows user switch ───────────────────────────────────

  describe('poll_sessions — Windows user switch', () => {
    it('does not kill child when active user matches primary user', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'primaryuser'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        clock.tick(5000);
        expect(fakeChild.kill.called).to.be.false;
        done();
      });
    });

    it('kills child when active user changes', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'user2'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        clock.tick(5000);
        expect(fakeChild.kill.calledOnce).to.be.true;
        done();
      });
    });

    it('does not kill child when get_logged_user errors', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(new Error('no user found')));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        clock.tick(5000);
        expect(fakeChild.kill.called).to.be.false;
        done();
      });
    });

    it('updates primary_user before killing to prevent repeated kills on next poll', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'user2'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        clock.tick(5000); // first poll → detects user2, kills child
        expect(fakeChild.kill.callCount).to.equal(1);
        clock.tick(5000); // second poll → primary_user already 'user2', no extra kill
        expect(fakeChild.kill.callCount).to.equal(1);
        done();
      });
    });

    it('clears poll timer so no further checks occur after stop', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'user2'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        lockRewired.stop();
        const killCountAfterStop = fakeChild.kill.callCount;
        clock.tick(15000);
        expect(fakeChild.kill.callCount).to.equal(killCountAfterStop);
        done();
      });
    });

    it('auto-restarts lock in new active session after kill by poll', (done) => {
      let spawnCount = 0;
      let lastChild;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        spawnCount++;
        lastChild = makeFakeChild('primaryuser');
        resolveSpawnCallback(opts, cb)(null, lastChild);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'user2'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        expect(spawnCount).to.equal(1);
        clock.tick(5000); // poll kills child
        lastChild.emit('exit', null); // simulate kill (no code) → open() restarts
        expect(spawnCount).to.equal(2);
        done();
      });
    });

    it('restores taskbar for old user when they switch back while lock is active', (done) => {
      let pollCount = 0;
      const runAsUserStub = sinon.stub().callsFake((cmd, args, cb) => { if (cb) cb(null); });
      lockRewired.__set__('run_as_user', runAsUserStub);

      let lastChild;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        lastChild = makeFakeChild('primaryuser');
        resolveSpawnCallback(opts, cb)(null, lastChild);
      });
      systemMock.get_logged_user.callsFake((cb) => {
        pollCount++;
        cb(null, pollCount === 1 ? 'user2' : 'primaryuser');
      });

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        clock.tick(5000); // first poll → user2 detected, kills child, sets pendingTbRestore
        lastChild.emit('exit', null); // restart for user2
        clock.tick(5000); // second poll → primaryuser back → tb-enable should run
        const tbCalls = runAsUserStub.getCalls().filter((c) => /tb-enable/.test(c.args[0]));
        expect(tbCalls.length).to.be.at.least(1);
        done();
      });
    });
  });

  // ─── restoreCleanupTimer — post-lock cleanup ────────────────────────────────

  describe('restoreCleanupTimer — post-lock cleanup', () => {
    it('starts cleanup timer after lock ends when previous user needs taskbar restore', (done) => {
      let spawnCount = 0;
      const children = [];
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        const ch = makeFakeChild(spawnCount === 0 ? 'primaryuser' : 'user2');
        children.push(ch);
        spawnCount++;
        resolveSpawnCallback(opts, cb)(null, ch);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'user2'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
        clock.tick(5000); // poll: pendingTbRestore = 'primaryuser', kills children[0]
        children[0].emit('exit', null); // restart → children[1] spawned synchronously

        emitter.on('end', () => {
          expect(lockRewired.__get__('restoreCleanupTimer')).to.not.be.null;
          done();
        });
        children[1].emit('exit', 66); // user2 unlocks → finished() starts cleanup timer
      });
    });

    it('cleanup timer self-clears when old user becomes active after lock ends', (done) => {
      const runAsUserStub = sinon.stub().callsFake((cmd, args, cb) => { if (cb) cb(null); });
      lockRewired.__set__('run_as_user', runAsUserStub);

      let spawnCount = 0;
      const children = [];
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        const ch = makeFakeChild(spawnCount === 0 ? 'primaryuser' : 'user2');
        children.push(ch);
        spawnCount++;
        resolveSpawnCallback(opts, cb)(null, ch);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'user2'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
        clock.tick(5000); // pendingTbRestore = 'primaryuser', kills children[0]
        children[0].emit('exit', null); // restart → children[1]

        emitter.on('end', () => {
          systemMock.get_logged_user.callsFake((cb) => cb(null, 'primaryuser'));
          clock.tick(5000); // cleanup timer: primaryuser active → tb-enable → clears timer
          expect(lockRewired.__get__('restoreCleanupTimer')).to.be.null;
          done();
        });
        children[1].emit('exit', 66);
      });
    });

    it('stop clears restoreCleanupTimer and pendingTbRestore', (done) => {
      const fakeChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, fakeChild);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'user2'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
        clock.tick(5000); // poll sets pendingTbRestore = 'primaryuser'
        lockRewired.stop();
        expect(lockRewired.__get__('restoreCleanupTimer')).to.be.null;
        expect(lockRewired.__get__('pendingTbRestore')).to.be.null;
        done();
      });
    });
  });

  // ─── finished — state cleanup ───────────────────────────────────────────────

  describe('finished — state cleanup', () => {
    it('resets primary_user to null after lock ends', (done) => {
      const primaryChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, primaryChild);
      });

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
        emitter.on('end', () => {
          const pu = lockRewired.__get__('primary_user');
          expect(pu).to.be.null;
          done();
        });
        primaryChild.emit('exit', 66);
      });
    });

    it('clears poll timer after lock ends', (done) => {
      const primaryChild = makeFakeChild('primaryuser');
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        resolveSpawnCallback(opts, cb)(null, primaryChild);
      });
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'primaryuser'));

      lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
        emitter.on('end', () => {
          const timer = lockRewired.__get__('session_poll_timer');
          expect(timer).to.be.null;
          done();
        });
        primaryChild.emit('exit', 66);
      });
    });
  });
});
