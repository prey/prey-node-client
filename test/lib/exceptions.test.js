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
});
