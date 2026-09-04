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
    ch.stderr = new EventEmitter();
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

  // ─── macOS — Prey.app + LockIPC ────────────────────────────────────────────
  //
  // Prey.app replaced prey-actions.app as the mac lock binary. It reports
  // failed attempts and accepts an unlock command over a unix socket instead
  // of printing to stdout, so the whole IPC lifecycle lives here.

  describe('macOS — Prey.app', () => {
    let ipcServerMock;
    let handles;

    function makeFakeIpc(sockPath) {
      const h = new EventEmitter();
      h.path = sockPath;
      h.connected = true;
      h.send = sinon.stub();
      h.close = sinon.stub().callsFake(() => { h.connected = false; });
      return h;
    }

    function rebuildBinaryPath() {
      lockRewired.__set__('lock_binary', lockRewired.__get__('lock_binary_path')());
    }

    function spawnedArgs(call) {
      return (call || systemMock.spawn_as_logged_user.firstCall).args[1];
    }

    beforeEach(() => {
      lockRewired.__set__('is_win', false);
      lockRewired.__set__('is_mac', true);
      lockRewired.__set__('is_linux', false);
      lockRewired.__set__('use_legacy_app', false);
      rebuildBinaryPath();

      handles = [];
      ipcServerMock = {
        sweep: sinon.stub(),
        createServer: sinon.stub().callsFake((cb) => {
          const h = makeFakeIpc(`/tmp/prey-lock-fake${handles.length}/l.sock`);
          handles.push(h);
          cb(null, h);
        }),
      };
      lockRewired.__set__('ipc_server', ipcServerMock);
    });

    // ─── binary selection ───────────────────────────────────────────────────

    describe('binary selection', () => {
      it('uses Prey.app', () => {
        expect(lockRewired.__get__('lock_binary'))
          .to.match(/utils\/Prey\.app\/Contents\/MacOS\/Prey$/);
      });

      it('uses Prey.app regardless of os_release', () => {
        const common = lockRewired.__get__('common');
        const original = common.os_release;

        ['10.15', '11.0', '15.4', undefined].forEach((release) => {
          common.os_release = release;
          rebuildBinaryPath();
          expect(lockRewired.__get__('lock_binary'), `os_release=${release}`)
            .to.match(/utils\/Prey\.app\/Contents\/MacOS\/Prey$/);
        });

        common.os_release = original;
      });

      it('falls back to prey-actions.app when PREY_LOCK_LEGACY_APP is set', () => {
        lockRewired.__set__('use_legacy_app', true);
        rebuildBinaryPath();
        expect(lockRewired.__get__('lock_binary'))
          .to.match(/utils\/prey-actions\.app\/Contents\/MacOS\/prey-actions$/);
      });

      it('keeps the legacy stdout contract and opens no socket in legacy mode', (done) => {
        lockRewired.__set__('use_legacy_app', true);
        rebuildBinaryPath();

        const fakeChild = makeFakeChild('claudio');
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          resolveSpawnCallback(opts, cb)(null, fakeChild);
        });

        lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
          expect(ipcServerMock.createServer.called).to.be.false;
          expect(spawnedArgs()).to.not.include('-socket');

          emitter.on('failed_unlock_attempt', () => done());
          fakeChild.stdout.emit('data', 'Invalid password');
        });
      });
    });

    // ─── argv ───────────────────────────────────────────────────────────────

    describe('argv', () => {
      beforeEach(() => {
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          resolveSpawnCallback(opts, cb)(null, makeFakeChild('claudio'));
        });
      });

      it('passes -socket before the message', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret', lock_message: 'hello' }, () => {
          const args = spawnedArgs();
          expect(args).to.have.lengthOf(5);
          expect(args[0]).to.equal('-lock');
          expect(args[1]).to.match(/^[0-9a-f]{32}$/);
          expect(args[2]).to.equal('-socket');
          expect(args[3]).to.equal(handles[0].path);
          expect(args[4]).to.equal('hello');
          done();
        });
      });

      it('hashes the password as md5(base64(password))', (done) => {
        const expected = require('crypto').createHash('md5')
          .update(Buffer.from('preyrocks').toString('base64'))
          .digest('hex');

        lockRewired.start('test-id', { unlock_pass: 'preyrocks' }, () => {
          expect(spawnedArgs()[1]).to.equal(expected);
          done();
        });
      });

      it('falls back to the default password when none is given', (done) => {
        const expected = require('crypto').createHash('md5')
          .update(Buffer.from(lockRewired.__get__('default_pass')).toString('base64'))
          .digest('hex');

        lockRewired.start('test-id', {}, () => {
          expect(spawnedArgs()[1]).to.equal(expected);
          done();
        });
      });

      it('still sends a trailing empty message when none is given', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          const args = spawnedArgs();
          expect(args).to.have.lengthOf(5);
          expect(args[4]).to.equal('');
          done();
        });
      });
    });

    // ─── socket lifecycle ───────────────────────────────────────────────────

    describe('socket lifecycle', () => {
      it('is listening before the app is spawned', (done) => {
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          resolveSpawnCallback(opts, cb)(null, makeFakeChild('claudio'));
        });

        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          sinon.assert.callOrder(ipcServerMock.createServer, systemMock.spawn_as_logged_user);
          done();
        });
      });

      it('sweeps stale sockets on start', (done) => {
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          resolveSpawnCallback(opts, cb)(null, makeFakeChild('claudio'));
        });

        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          expect(ipcServerMock.sweep.calledOnce).to.be.true;
          done();
        });
      });

      it('tears the socket down between NO_LOGGED_USER retries', (done) => {
        let attempts = 0;
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          const callback = resolveSpawnCallback(opts, cb);
          attempts += 1;
          if (attempts < 2) {
            const err = new Error('no logged user');
            err.code = 'NO_LOGGED_USER';
            return callback(err);
          }
          return callback(null, makeFakeChild('claudio'));
        });

        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          // one server per attempt, and the first one was closed before waiting
          expect(ipcServerMock.createServer.callCount).to.equal(2);
          expect(handles[0].close.calledOnce).to.be.true;
          expect(handles[0].path).to.not.equal(handles[1].path);
          done();
        });

        clock.tick(5000);
      });

      it('locks without a socket when the server cannot be created', (done) => {
        ipcServerMock.createServer.callsFake((cb) => cb(new Error('EACCES')));
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          resolveSpawnCallback(opts, cb)(null, makeFakeChild('claudio'));
        });

        lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
          expect(err).to.be.null;
          expect(emitter).to.be.an.instanceOf(EventEmitter);
          expect(spawnedArgs()).to.not.include('-socket');
          done();
        });
      });

      it('closes the socket when the lock exits', (done) => {
        const fakeChild = makeFakeChild('claudio');
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          resolveSpawnCallback(opts, cb)(null, fakeChild);
        });

        lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
          emitter.on('end', () => {
            expect(handles[0].close.calledOnce).to.be.true;
            expect(lockRewired.__get__('ipc')).to.be.null;
            done();
          });
          fakeChild.emit('exit', 66);
        });
      });
    });

    // ─── events ─────────────────────────────────────────────────────────────

    describe('IPC events', () => {
      let fakeChild;

      beforeEach(() => {
        fakeChild = makeFakeChild('claudio');
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          resolveSpawnCallback(opts, cb)(null, fakeChild);
        });
      });

      it('maps failed_unlock_attempt onto the action emitter', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
          emitter.on('failed_unlock_attempt', () => done());
          handles[0].emit('event', { event: 'failed_unlock_attempt' });
        });
      });

      it('does not end the action on unlock_success alone', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
          let ended = false;
          emitter.on('end', () => { ended = true; });

          handles[0].emit('event', { event: 'unlock_success' });

          // end belongs to exit 66; reacting to both would double-fire it
          expect(ended).to.be.false;
          done();
        });
      });

      it('ignores status and unknown events', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
          let fired = false;
          emitter.on('failed_unlock_attempt', () => { fired = true; });

          expect(() => {
            handles[0].emit('event', { event: 'status', locked: true });
            handles[0].emit('event', { event: 'who_knows' });
          }).to.not.throw();

          expect(fired).to.be.false;
          done();
        });
      });
    });

    // ─── stop ───────────────────────────────────────────────────────────────

    describe('stop', () => {
      let fakeChild;

      beforeEach(() => {
        fakeChild = makeFakeChild('claudio');
        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          resolveSpawnCallback(opts, cb)(null, fakeChild);
        });
      });

      it('asks Prey.app to unlock instead of killing it', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          lockRewired.stop();
          expect(handles[0].send.calledOnceWithExactly({ cmd: 'unlock' })).to.be.true;
          expect(fakeChild.kill.called).to.be.false;
          done();
        });
      });

      it('kills the lock when the unlock command goes unanswered', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          lockRewired.stop();
          clock.tick(3000);
          expect(fakeChild.kill.calledOnce).to.be.true;
          done();
        });
      });

      it('does not kill the lock when it exits before the timeout', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
          emitter.on('end', () => {
            clock.tick(3000);
            expect(fakeChild.kill.called).to.be.false;
            done();
          });
          lockRewired.stop();
          fakeChild.emit('exit', 66);
        });
      });

      it('kills directly when the socket is already gone', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          handles[0].connected = false;
          lockRewired.stop();
          expect(handles[0].send.called).to.be.false;
          expect(fakeChild.kill.calledOnce).to.be.true;
          done();
        });
      });

      // setTouchPadState is Windows-only; on mac it hands cp.spawn an object
      // where a string is expected and throws synchronously.
      it('never touches the touchpad on mac', (done) => {
        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          handles[0].connected = false;
          expect(() => lockRewired.stop()).to.not.throw();
          expect(systemMock.spawn_as_admin_user.called).to.be.false;
          done();
        });
      });
    });

    // ─── anti-tamper relaunch ───────────────────────────────────────────────

    describe('relaunch', () => {
      it('recreates the socket with a fresh path when the lock is killed', (done) => {
        const first = makeFakeChild('claudio');
        const second = makeFakeChild('claudio');
        let spawns = 0;

        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          spawns += 1;
          resolveSpawnCallback(opts, cb)(null, spawns === 1 ? first : second);
        });

        lockRewired.start('test-id', { unlock_pass: 'secret' }, () => {
          first.emit('exit', null);

          expect(spawns).to.equal(2);
          expect(ipcServerMock.createServer.callCount).to.equal(2);
          expect(handles[0].close.calledOnce).to.be.true;
          expect(spawnedArgs(systemMock.spawn_as_logged_user.secondCall)[3])
            .to.equal(handles[1].path);
          expect(handles[1].path).to.not.equal(handles[0].path);
          done();
        });
      });

      it('routes events from the relaunched lock to the original emitter', (done) => {
        const first = makeFakeChild('claudio');
        const second = makeFakeChild('claudio');
        let spawns = 0;

        systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
          spawns += 1;
          resolveSpawnCallback(opts, cb)(null, spawns === 1 ? first : second);
        });

        lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
          emitter.on('failed_unlock_attempt', () => done());
          first.emit('exit', null);
          handles[1].emit('event', { event: 'failed_unlock_attempt' });
        });
      });

      [66, 67, 127].forEach((code) => {
        it(`ends the action on exit ${code} without relaunching`, (done) => {
          const fakeChild = makeFakeChild('claudio');
          systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
            resolveSpawnCallback(opts, cb)(null, fakeChild);
          });

          lockRewired.start('test-id', { unlock_pass: 'secret' }, (err, emitter) => {
            emitter.on('end', () => {
              expect(systemMock.spawn_as_logged_user.calledOnce).to.be.true;
              expect(handles[0].close.calledOnce).to.be.true;
              done();
            });
            fakeChild.emit('exit', code);
          });
        });
      });
    });
  });
});
