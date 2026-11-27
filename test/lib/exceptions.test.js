/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable global-require */
const { expect } = require('chai');
const sinon = require('sinon');
const needle = require('needle');
const storage = require('../../lib/agent/utils/storage');
const keys = require('../../lib/agent/control-panel/api/keys');
const config = require('../../lib/utils/configfile');

describe('exceptions', () => {
  let storageDoStub;
  let needlePostStub;
  let savedTesting;
  let exceptionsModule;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  beforeEach(() => {
    savedTesting = process.env.TESTING;
    delete process.env.TESTING;

    // Reset in-memory quota state between tests by re-requiring the module
    delete require.cache[require.resolve('../../lib/exceptions')];
    exceptionsModule = require('../../lib/exceptions');

    storageDoStub = sinon.stub(storage, 'do');
    needlePostStub = sinon.stub(needle, 'post').callsFake((url, data, opts, cb) => cb(null));
    sinon.stub(keys, 'get').returns({ device: 'test-device-key' });
  });

  afterEach(() => {
    if (savedTesting === undefined) {
      delete process.env.TESTING;
    } else {
      process.env.TESTING = savedTesting;
    }
    sinon.restore();
  });

  describe('send()', () => {
    it('returns early without sending when TESTING env var is set', (done) => {
      process.env.TESTING = '1';
      exceptionsModule.send(new Error('test'), (err) => {
        expect(err).to.be.undefined;
        expect(needlePostStub.called).to.be.false;
        done();
      });
    });

    it('returns error when argument is not an Error instance', (done) => {
      exceptionsModule.send('not an error', (err) => {
        expect(err).to.be.instanceOf(Error);
        expect(err.message).to.equal('Not an error.');
        done();
      });
    });

    it('skips sending when err.level is set to any non-null value', (done) => {
      const err = new Error('known expected error');
      err.level = 'expected';
      exceptionsModule.send(err, () => {
        expect(needlePostStub.called).to.be.false;
        done();
      });
    });

    it('still sends when err.level is not set', (done) => {
      storageDoStub
        .onFirstCall().callsFake((op, opts, cb) => cb(null, []))
        .onSecondCall().callsFake((op, opts, cb) => cb(null));

      const err = new Error('real unexpected error');
      exceptionsModule.send(err, () => {
        expect(needlePostStub.calledOnce).to.be.true;
        done();
      });
    });

    it('sends and creates quota on first call with no prior DB record', (done) => {
      storageDoStub
        .onFirstCall().callsFake((op, opts, cb) => cb(null, [])) // query returns empty
        .onSecondCall().callsFake((op, opts, cb) => {
          expect(op).to.equal('set');
          cb(null);
        });

      exceptionsModule.send(new Error('first error'), (err) => {
        expect(err).to.be.null;
        expect(needlePostStub.calledOnce).to.be.true;
        done();
      });
    });

    it('sends and updates quota when within both daily and per-error limits', (done) => {
      const quota = { date: today, total: 5, errors: { 'some error': 1 } };
      storageDoStub
        .onFirstCall().callsFake((op, opts, cb) => cb(null, [{ value: JSON.stringify(quota) }]))
        .onSecondCall().callsFake((op, opts, cb) => {
          expect(op).to.equal('update');
          cb(null);
        });

      exceptionsModule.send(new Error('some error'), (err) => {
        expect(err).to.be.null;
        expect(needlePostStub.calledOnce).to.be.true;
        done();
      });
    });

    it('blocks sending when the daily total limit is reached', (done) => {
      const dailyLimit = config.getData('exceptions_daily_limit') || 50;
      const quota = { date: today, total: dailyLimit, errors: {} };
      const storedValue = [{ value: JSON.stringify(quota) }];
      storageDoStub.onFirstCall().callsFake((op, opts, cb) => cb(null, storedValue));

      exceptionsModule.send(new Error('any error'), (err) => {
        expect(err).to.be.undefined;
        expect(needlePostStub.called).to.be.false;
        done();
      });
    });

    it('blocks sending when the per-error limit for that message is reached', (done) => {
      const perErrorLimit = config.getData('exceptions_per_error_limit') || 3;
      const quota = { date: today, total: 10, errors: { 'repeated error': perErrorLimit } };
      const storedValue = [{ value: JSON.stringify(quota) }];
      storageDoStub.onFirstCall().callsFake((op, opts, cb) => cb(null, storedValue));

      exceptionsModule.send(new Error('repeated error'), (err) => {
        expect(err).to.be.undefined;
        expect(needlePostStub.called).to.be.false;
        done();
      });
    });

    it('resets quota and sends when stored quota is from a previous day', (done) => {
      const staleQuota = { date: yesterday, total: 50, errors: { 'old error': 3 } };
      const storedStale = [{ value: JSON.stringify(staleQuota) }];
      storageDoStub
        .onFirstCall().callsFake((op, opts, cb) => cb(null, storedStale))
        .onSecondCall().callsFake((op, opts, cb) => {
          expect(op).to.equal('set');
          const saved = JSON.parse(opts.data.value);
          expect(saved.date).to.equal(today);
          expect(saved.total).to.equal(1);
          cb(null);
        });

      exceptionsModule.send(new Error('new error today'), (err) => {
        expect(err).to.be.null;
        expect(needlePostStub.calledOnce).to.be.true;
        done();
      });
    });

    it('fails open and sends when storage read fails', (done) => {
      storageDoStub.onFirstCall().callsFake((op, opts, cb) => cb(new Error('DB unavailable')));

      exceptionsModule.send(new Error('storage failing'), (err) => {
        expect(err).to.be.null;
        expect(needlePostStub.calledOnce).to.be.true;
        done();
      });
    });

    it('blocks the 4th send of the same message using in-memory counters', (done) => {
      // First call loads empty DB, subsequent calls use in-memory state
      storageDoStub.callsFake((op, opts, cb) => {
        if (op === 'query') cb(null, []);
        else cb(null); // set/update
      });

      const perErrorLimit = config.getData('exceptions_per_error_limit') || 3;
      const msg = 'same recurring error';
      let sentCount = 0;
      let blockedCount = 0;

      const series = (tasks, finish) => {
        const run = (i) => {
          if (i >= tasks.length) return finish();
          return tasks[i](() => run(i + 1));
        };
        run(0);
      };

      series(
        Array.from({ length: perErrorLimit + 1 }, () => (cb) => {
          exceptionsModule.send(new Error(msg), () => cb());
        }),
        () => {
          sentCount = needlePostStub.callCount;
          blockedCount = perErrorLimit + 1 - sentCount;
          expect(sentCount).to.equal(perErrorLimit);
          expect(blockedCount).to.equal(1);
          done();
        },
      );
    });
  });

  // The in-memory keys are only set by the agent's control panel: processes like the
  // conf CLI must still report which device the exception came from.
  describe('deviceKey resolution', () => {
    const DK_KEY = 'control-panel.device_key';
    let savedConfigKey;

    // Quota read returns empty, quota write succeeds; `preyconfRows` answers the preyconf query.
    const stubStorage = (preyconfRows) => {
      storageDoStub.callsFake((op, opts, cb) => {
        if (op === 'query' && opts.data === 'preyconf') return cb(null, preyconfRows);
        if (op === 'query') return cb(null, []);
        return cb(null);
      });
    };
    const sentDeviceKey = () => needlePostStub.firstCall.args[1].deviceKey;

    beforeEach(() => {
      // configfile exports a frozen instance, so set the value on its (unfrozen) data object.
      savedConfigKey = config.all()[DK_KEY];
      config.all()[DK_KEY] = null;
      keys.get.returns({});
    });

    afterEach(() => {
      config.all()[DK_KEY] = savedConfigKey;
    });

    it('uses the in-memory key when the agent has set it', (done) => {
      keys.get.returns({ device: 'memory-key' });
      config.all()[DK_KEY] = 'config-key';
      stubStorage(null);

      exceptionsModule.send(new Error('from agent'), () => {
        expect(sentDeviceKey()).to.equal('memory-key');
        done();
      });
    });

    it('falls back to the loaded config when the in-memory keys are empty (conf CLI)', (done) => {
      config.all()[DK_KEY] = 'config-key';
      stubStorage(null);

      exceptionsModule.send(new Error('from cli'), () => {
        expect(sentDeviceKey()).to.equal('config-key');
        expect(storageDoStub.calledWith('query', sinon.match({ data: 'preyconf' }))).to.be.false;
        done();
      });
    });

    it('reads the preyconf row when the config has not loaded yet', (done) => {
      stubStorage([{ value: JSON.stringify({ [DK_KEY]: 'db-key' }) }]);

      exceptionsModule.send(new Error('cli crashed early'), () => {
        expect(sentDeviceKey()).to.equal('db-key');
        done();
      });
    });

    it('still sends with a null key when the preyconf row is missing', (done) => {
      stubStorage(null);

      exceptionsModule.send(new Error('no row'), () => {
        expect(needlePostStub.calledOnce).to.be.true;
        expect(sentDeviceKey()).to.be.null;
        done();
      });
    });

    it('still sends with a null key when the preyconf row is not valid JSON', (done) => {
      stubStorage([{ value: '{not json' }]);

      exceptionsModule.send(new Error('bad row'), () => {
        expect(needlePostStub.calledOnce).to.be.true;
        expect(sentDeviceKey()).to.be.null;
        done();
      });
    });

    it('still sends with a null key when reading commands.db fails', (done) => {
      storageDoStub.callsFake((op, opts, cb) => {
        if (op === 'query' && opts.data === 'preyconf') return cb(new Error('SQLITE_BUSY'));
        if (op === 'query') return cb(null, []);
        return cb(null);
      });

      exceptionsModule.send(new Error('db busy'), () => {
        expect(needlePostStub.calledOnce).to.be.true;
        expect(sentDeviceKey()).to.be.null;
        done();
      });
    });
  });

  // send's callback is what lets uncaughtException handlers exit or shut down, so it
  // must fire even when commands.db or the exceptions server never answers.
  describe('timeouts', () => {
    let clock;

    beforeEach(() => {
      clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      keys.get.returns({});
    });

    afterEach(() => {
      clock.restore();
    });

    it('sends with a null device key when the preyconf lookup never answers', () => {
      const savedConfigKey = config.all()['control-panel.device_key'];
      config.all()['control-panel.device_key'] = null;
      storageDoStub.callsFake((op, opts, cb) => {
        if (op === 'query' && opts.data === 'preyconf') return undefined; // stuck queue
        if (op === 'query') return cb(null, []);
        return cb(null);
      });
      const cb = sinon.spy();

      exceptionsModule.send(new Error('stuck lookup'), cb);
      expect(needlePostStub.called).to.be.false;
      clock.tick(3000);
      config.all()['control-panel.device_key'] = savedConfigKey;

      expect(needlePostStub.calledOnce).to.be.true;
      expect(needlePostStub.firstCall.args[1].deviceKey).to.be.null;
      expect(cb.calledOnce).to.be.true;
    });

    it('calls back once with a timeout error when the report never completes', () => {
      keys.get.returns({ device: 'test-device-key' });
      storageDoStub.callsFake((op, opts, cb) => (op === 'query' ? cb(null, []) : cb(null)));
      needlePostStub.callsFake(() => {}); // server never answers
      const cb = sinon.spy();

      exceptionsModule.send(new Error('slow server'), cb);
      clock.tick(9999);
      expect(cb.called).to.be.false;
      clock.tick(1);
      expect(cb.calledOnce).to.be.true;
      expect(cb.firstCall.args[0]).to.be.an('error');
      expect(cb.firstCall.args[0].message).to.equal('Exception report timed out');
      clock.tick(20000);
      expect(cb.calledOnce).to.be.true;
    });

    it('calls back once with a timeout error when the storage queue never answers', () => {
      storageDoStub.callsFake(() => {}); // quota read stuck
      const cb = sinon.spy();

      exceptionsModule.send(new Error('stuck queue'), cb);
      clock.tick(10000);
      expect(cb.calledOnce).to.be.true;
      expect(needlePostStub.called).to.be.false;
    });

    it('does not keep a deadline timer when there is no callback', () => {
      storageDoStub.callsFake(() => {});
      exceptionsModule.send(new Error('fire and forget'));
      expect(clock.countTimers()).to.equal(0);
    });
  });

  describe('quota persistence', () => {
    it('inserts the quota row again when the first insert failed', (done) => {
      storageDoStub.callsFake((op, opts, cb) => {
        if (op === 'query') return cb(null, []);
        if (op === 'set') return cb(new Error('SQLITE_BUSY'));
        return cb(null);
      });

      exceptionsModule.send(new Error('first'), () => {
        exceptionsModule.send(new Error('second'), () => {
          const ops = storageDoStub.getCalls().map((c) => c.args[0]).filter((op) => op !== 'query');
          expect(ops).to.deep.equal(['set', 'set']);
          done();
        });
      });
    });

    it('updates the quota row once the insert succeeded', (done) => {
      storageDoStub.callsFake((op, opts, cb) => (op === 'query' ? cb(null, []) : cb(null)));

      exceptionsModule.send(new Error('first'), () => {
        exceptionsModule.send(new Error('second'), () => {
          const ops = storageDoStub.getCalls().map((c) => c.args[0]).filter((op) => op !== 'query');
          expect(ops).to.deep.equal(['set', 'update']);
          done();
        });
      });
    });

    // Real sqlite: the quota keys are error messages, and one quoting a flag (`'--`)
    // used to comment out the UPDATE's WHERE and overwrite every keys row.
    it('keeps the other keys rows intact when the message holds a quoted flag', function (done) {
      this.timeout(10000);
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const rewire = require('rewire');
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prey-exceptions-'));
      const realStorage = rewire('../../lib/agent/utils/storage');
      realStorage.__set__('dbExists', () => dir);
      storageDoStub.callsFake((op, opts, cb) => realStorage.do(op, opts, cb));

      const preyconf = '{"control-panel.device_key":"abc"}';
      const message = "unknown option '--force'";
      const finish = (e) => {
        fs.rmSync(dir, { recursive: true, force: true });
        done(e);
      };
      realStorage.do('set', { type: 'keys', id: 'preyconf', data: { value: preyconf } }, () => {});
      realStorage.do('set', {
        type: 'keys',
        id: 'exception_quota',
        data: { value: JSON.stringify({ date: today, total: 0, errors: {} }) },
      }, () => {});
      realStorage.do('all', { type: 'keys' }, () => {
        exceptionsModule.send(new Error(message), () => {
          // The quota UPDATE was queued before send called back, so this read follows it.
          realStorage.do('all', { type: 'keys' }, (err, rows) => {
            try {
              expect(err).to.be.null;
              const byId = Object.fromEntries(rows.map((r) => [r.id, r.value]));
              expect(byId.preyconf).to.equal(preyconf);
              expect(JSON.parse(byId.exception_quota).errors).to.deep.equal({ [message]: 1 });
              finish();
            } catch (e) {
              finish(e);
            }
          });
        });
      });
    });
  });

  describe('reported args', () => {
    const NODE = 'C:\\Windows\\Prey\\current\\bin\\node.exe';
    const CLI = 'C:\\Windows\\Prey\\current\\lib\\conf\\cli.js';
    let savedArgv;

    beforeEach(() => {
      savedArgv = process.argv;
    });

    afterEach(() => {
      process.argv = savedArgv;
    });

    it('keeps the subcommand that lib/conf/cli.js splices out of process.argv', (done) => {
      storageDoStub.callsFake((op, opts, cb) => cb(null, []));
      process.argv = [NODE, CLI, 'config', 'settings', 'read', 'control-panel.device_key'];
      delete require.cache[require.resolve('../../lib/exceptions')];
      exceptionsModule = require('../../lib/exceptions');
      process.argv.splice(3); // what cli.js does on startup

      exceptionsModule.send(new Error('from cli'), () => {
        expect(needlePostStub.firstCall.args[1].args)
          .to.deep.equal([NODE, CLI, 'config', 'settings', 'read', 'control-panel.device_key']);
        done();
      });
    });

    it('keeps the command words and the version argument', () => {
      expect(exceptionsModule.reportedArgs([NODE, CLI, 'config', 'upgrade', '1.13.44']))
        .to.deep.equal([NODE, CLI, 'config', 'upgrade', '1.13.44']);
    });

    it('stops at the first flag, so credentials are never reported', () => {
      const argv = [NODE, CLI, 'config', 'account', 'authorize', '-e', 'me@example.com', '-p', 'secret'];
      expect(exceptionsModule.reportedArgs(argv))
        .to.deep.equal([NODE, CLI, 'config', 'account', 'authorize']);
      expect(exceptionsModule.reportedArgs([NODE, CLI, 'config', 'account', 'setup', '--api-key=abc']))
        .to.deep.equal([NODE, CLI, 'config', 'account', 'setup']);
    });

    it('reports at most four command words', () => {
      const argv = [NODE, CLI, 'config', 'settings', 'update', 'some.key', 'some-value'];
      expect(exceptionsModule.reportedArgs(argv))
        .to.deep.equal([NODE, CLI, 'config', 'settings', 'update', 'some.key']);
    });

    it('never reports a setting value passed to `settings update`', () => {
      const argv = [NODE, CLI, 'config', 'settings', 'update', 'control-panel.api_key', 'SECRET'];
      expect(exceptionsModule.reportedArgs(argv)).to.not.include('SECRET');
    });

    it('handles an argv with no command words', () => {
      expect(exceptionsModule.reportedArgs([NODE])).to.deep.equal([NODE]);
      expect(exceptionsModule.reportedArgs([NODE, '/usr/lib/prey/bin/prey', '-d']))
        .to.deep.equal([NODE, '/usr/lib/prey/bin/prey']);
    });
  });
});
