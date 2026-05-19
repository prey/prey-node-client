/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('reports', () => {
  let reports;
  let logger;
  let providersStub;
  let clock;

  beforeEach(() => {
    reports = rewire('../../../lib/agent/reports');

    logger = {
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy(),
      debug: sinon.spy(),
    };
    reports.__set__('logger', logger);

    providersStub = { get: sinon.stub() };
    reports.__set__('providers', providersStub);
    reports.__set__('hooks', { emit: sinon.stub(), trigger: sinon.stub() });
    reports.__set__('config', { setData: sinon.stub(), getData: sinon.stub().returns(null) });
  });

  afterEach(() => {
    if (clock) { clock.restore(); clock = null; }
    sinon.restore();
    delete require.cache[require.resolve('../../../lib/agent/reports')];
  });

  describe('gather coalescing guard (in queue)', () => {
    it('should skip an interval tick if a gather is already in progress', () => {
      clock = sinon.useFakeTimers();
      reports.__set__('setInterval', setInterval); // use sinon-faked global

      // providers.get never calls back — simulates a hanging gather
      providersStub.get.callsFake(() => {});

      const queue = reports.__get__('queue');
      queue('load', ['cpu_load'], { interval: 1000 });

      // First tick: starts gather, sets gatheringNow.load = true
      clock.tick(1000);
      expect(reports.__get__('gatheringNow').load).to.be.true;

      // Second tick while first is still in progress: should be skipped
      clock.tick(1000);
      expect(logger.warn.calledWith('load gather already in progress, skipping interval tick.')).to.be.true;

      // providers.get was called only once (second tick was skipped)
      expect(providersStub.get.callCount).to.equal(1);
    });

    it('should allow a new gather once the previous one finishes', () => {
      clock = sinon.useFakeTimers();
      reports.__set__('setInterval', setInterval);

      let doneCb;
      // providers.get captures the done callback so we can call it manually
      providersStub.get.callsFake((_key, cb) => { doneCb = cb; });

      const queue = reports.__get__('queue');
      queue('load', ['cpu_load'], { interval: 1000 });

      // First tick: starts gather
      clock.tick(1000);
      expect(reports.__get__('gatheringNow').load).to.be.true;

      // Manually finish the gather
      doneCb(null, 42, 'cpu_load', 0);
      expect(reports.__get__('gatheringNow').load).to.be.false;

      // Third tick: should proceed since flag is clear
      clock.tick(1000);
      expect(logger.warn.called).to.be.false;
      expect(providersStub.get.callCount).to.equal(2);
    });

    it('should not skip explicit get() calls even when interval gather is in progress', () => {
      clock = sinon.useFakeTimers();

      // Set gatheringNow as if interval gather is running
      reports.__set__('gatheringNow', { load: true });
      reports.__set__('available', { load: ['cpu_load'] });

      const gather = reports.__get__('gather');
      const cb = sinon.spy();

      // Direct gather with callback (explicit request, not from interval)
      gather('load', ['cpu_load'], cb);

      // Should have called providers.get — gather was not skipped
      expect(providersStub.get.calledOnce).to.be.true;
      expect(logger.warn.called).to.be.false;
    });
  });

  describe('retry limit', () => {
    it('should not retry more than 3 times when a provider keeps failing', (done) => {
      clock = sinon.useFakeTimers();
      const gather = reports.__get__('gather');
      let callCount = 0;

      providersStub.get.callsFake((key, doneCb, _opts, timesLimit) => {
        callCount += 1;
        doneCb(new Error('fail'), null, key, (timesLimit || 0) + 1);
      });

      gather('load', ['cpu_load']);

      // Advance past 3 retries × 5000ms each
      clock.tick(20000);

      // Initial call + up to 3 retries = 4 calls max
      expect(callCount).to.be.at.most(4);
      done();
    });
  });
});
