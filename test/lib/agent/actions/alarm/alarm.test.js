/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const chai = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const { EventEmitter } = require('events');

const { expect } = chai;

describe('alarm action', () => {
  let alarmRewired;
  let osName;
  let systemMock;
  let execStub;
  let fsExistsSyncStub;
  let fakeChild;
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();

    // Create a fake child process
    fakeChild = new EventEmitter();
    fakeChild.kill = sinon.stub();
    fakeChild.exitCode = null;

    // Create system mock
    systemMock = {
      spawn_as_logged_user: sinon.stub(),
      run_as_logged_user: sinon.stub().callsFake((cmd, args, cb) => {
        if (typeof cb === 'function') cb(null);
      }),
      get_logged_user: sinon.stub(),
    };

    execStub = sinon.stub();

    // Rewire the module
    alarmRewired = rewire('../../../../../lib/agent/actions/alarm');
    alarmRewired.__set__('system', systemMock);
    alarmRewired.__set__('exec', execStub);
    osName = alarmRewired.__get__('os_name');

    fsExistsSyncStub = sinon.stub();
    alarmRewired.__set__('fs', { existsSync: fsExistsSyncStub });
  });

  afterEach(() => {
    clock.restore();
    sinon.restore();
  });

  describe('start', () => {
    it('should return an emitter via callback', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', {}, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.be.an.instanceOf(EventEmitter);
        done();
      });
    });

    it('should use default alarm sound when no sound option is provided', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        expect(args[0]).to.include('alarm.mp3');
        cb(null, fakeChild);
        done();
      });

      alarmRewired.start('test-id', {}, () => {});
    });

    it('should use specified sound file from options', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        expect(args[0]).to.include('siren.mp3');
        cb(null, fakeChild);
        done();
      });

      alarmRewired.start('test-id', { sound: 'siren' }, () => {});
    });

    it('should use file option over sound option', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        expect(args[0]).to.include('modem.mp3');
        cb(null, fakeChild);
        done();
      });

      alarmRewired.start('test-id', { file: 'modem', sound: 'siren' }, () => {});
    });

    it('should use file from filesystem if it exists', (done) => {
      fsExistsSyncStub.returns(true);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        expect(args[0]).to.equal('alarm.mp3');
        cb(null, fakeChild);
        done();
      });

      alarmRewired.start('test-id', {}, () => {});
    });

    it('should fallback to lib directory if file does not exist', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        expect(args[0]).to.include('lib');
        expect(args[0]).to.include('alarm.mp3');
        cb(null, fakeChild);
        done();
      });

      alarmRewired.start('test-id', {}, () => {});
    });

    it('should emit end event when playback finishes with 1 loop', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', { loops: 1 }, (err, emitter) => {
        emitter.on('end', (id, endErr) => {
          expect(id).to.equal('test-id');
          expect(endErr).to.be.undefined;
          done();
        });
      });

      // Simulate child process exit
      fakeChild.emit('exit', 0);
    });

    it('should play multiple loops before emitting end', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));

      let spawnCount = 0;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        spawnCount++;
        const child = new EventEmitter();
        child.kill = sinon.stub();
        child.exitCode = null;
        cb(null, child);
        child.emit('exit', 0);
      });

      alarmRewired.start('test-id', { loops: 3 }, (err, emitter) => {
        emitter.on('end', () => {
          expect(spawnCount).to.equal(3);
          done();
        });
      });
    });

    it('should parse loops option as integer', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));

      let spawnCount = 0;
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        spawnCount++;
        const child = new EventEmitter();
        child.kill = sinon.stub();
        child.exitCode = null;
        cb(null, child);
        child.emit('exit', 0);
      });

      alarmRewired.start('test-id', { loops: '2' }, (err, emitter) => {
        emitter.on('end', () => {
          expect(spawnCount).to.equal(2);
          done();
        });
      });
    });

    it('should emit end with error when spawn fails and no user fallback', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(new Error('spawn failed'));
      });

      alarmRewired.start('test-id', {}, (err, emitter) => {
        emitter.on('end', (id, endErr) => {
          expect(id).to.equal('test-id');
          expect(endErr.message).to.equal('spawn failed');
          done();
        });
      });
    });

    it('should emit end with error on child process error', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', {}, (err, emitter) => {
        emitter.on('end', (id) => {
          // error event passes the error as first arg to done, so id receives the Error
          expect(id).to.be.an.instanceOf(Error);
          expect(id.message).to.equal('playback error');
          done();
        });
      });

      fakeChild.emit('error', new Error('playback error'));
    });

    it('should raise volume at intervals', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', {}, () => {});

      // Advance clock to trigger interval
      clock.tick(1000);
      if (osName === 'linux') expect(systemMock.run_as_logged_user.callCount).to.equal(2);
      else expect(execStub.calledOnce).to.be.true;

      clock.tick(1000);
      if (osName === 'linux') expect(systemMock.run_as_logged_user.callCount).to.equal(4);
      else expect(execStub.calledTwice).to.be.true;

      done();
    });

    it('should clear interval when done', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', {}, (err, emitter) => {
        emitter.on('end', () => {
          // After done, advancing clock should not trigger more exec calls
          const callCount = (osName === 'linux')
            ? systemMock.run_as_logged_user.callCount
            : execStub.callCount;
          clock.tick(3000);
          if (osName === 'linux') expect(systemMock.run_as_logged_user.callCount).to.equal(callCount);
          else expect(execStub.callCount).to.equal(callCount);
          done();
        });
      });

      clock.tick(1000); // trigger one interval
      fakeChild.emit('exit', 0);
    });

    it('should handle empty options object', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', {}, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.exist;
        done();
      });
    });

    it('should handle undefined options', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', undefined, (err, emitter) => {
        expect(err).to.be.null;
        expect(emitter).to.exist;
        done();
      });
    });

    it('should emit end with error when get_logged_user fails', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => {
        cb(new Error('no user found'));
      });

      alarmRewired.start('test-id', {}, (err, emitter) => {
        emitter.on('end', (id, endErr) => {
          expect(id).to.equal('test-id');
          expect(endErr.message).to.equal('no user found');
          done();
        });
      });
    });

    it('should play alarm for lock screen user on Windows', (done) => {
      fsExistsSyncStub.returns(false);
      const lockScreenErr = new Error('LockedUser - System on Windows Lock Screen state.');
      systemMock.get_logged_user.callsFake((cb) => cb(lockScreenErr));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb, user) => {
        expect(user).to.equal('LockedUser');
        cb(null, fakeChild);
        done();
      });

      alarmRewired.start('test-id', {}, () => {});
    });

    it('should raise volume for lock screen user on Windows', (done) => {
      fsExistsSyncStub.returns(false);
      const lockScreenErr = new Error('LockedUser - System on Windows Lock Screen state.');
      systemMock.get_logged_user.callsFake((cb) => cb(lockScreenErr));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb, user) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', {}, () => {});

      clock.tick(1000);
      if (osName === 'linux') expect(systemMock.run_as_logged_user.callCount).to.equal(2);
      else expect(execStub.calledOnce).to.be.true;
      done();
    });

    it('should only call done once even if multiple exit events fire', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      let endCount = 0;
      alarmRewired.start('test-id', {}, (err, emitter) => {
        emitter.on('end', () => {
          endCount++;
        });
      });

      fakeChild.emit('exit', 0);
      fakeChild.emit('exit', 0);
      expect(endCount).to.equal(1);
      done();
    });
  });

  describe('stop', () => {
    it('should kill child process if it is running', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', {}, () => {});

      // Child should be set now
      alarmRewired.stop();
      expect(fakeChild.kill.calledOnce).to.be.true;
      done();
    });

    it('should not kill child process if it already exited', (done) => {
      fsExistsSyncStub.returns(false);
      systemMock.get_logged_user.callsFake((cb) => cb(null, 'testuser'));
      systemMock.spawn_as_logged_user.callsFake((cmd, args, opts, cb) => {
        fakeChild.exitCode = 1;
        cb(null, fakeChild);
      });

      alarmRewired.start('test-id', {}, () => {});

      alarmRewired.stop();
      expect(fakeChild.kill.called).to.be.false;
      done();
    });

    it('should not throw if no child process exists', () => {
      expect(() => alarmRewired.stop()).to.not.throw();
    });
  });
});
