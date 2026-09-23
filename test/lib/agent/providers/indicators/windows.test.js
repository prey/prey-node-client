'use strict';

const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');

describe('lib/agent/providers/indicators/windows get_battery_status', () => {
  let mod;
  let batteryStub;
  let clock;

  beforeEach(() => {
    // Install fake timers BEFORE rewire so the module (loaded in an isolated
    // rewire scope) picks up the faked Date. Fresh module each test → empty cache.
    clock = sinon.useFakeTimers();
    mod = rewire('../../../../../lib/agent/providers/indicators/windows');
    batteryStub = sinon.stub();
    mod.__set__('battery', batteryStub);
  });

  afterEach(() => sinon.restore());

  it('maps charging battery data to the expected shape', (done) => {
    batteryStub.callsFake((cb) => cb({ percent: 55, isCharging: true, timeRemaining: 42 }));

    mod.get_battery_status((err, data) => {
      expect(err).to.be.null;
      expect(data).to.deep.equal({
        percentage_remaining: 55,
        state: 'charging',
        time_remaining: 42,
      });
      done();
    });
  });

  it('reports discharging when not charging and below 100%', (done) => {
    batteryStub.callsFake((cb) => cb({ percent: 80, isCharging: false, timeRemaining: 100 }));

    mod.get_battery_status((err, data) => {
      expect(data.state).to.equal('discharging');
      done();
    });
  });

  it('reports charged at 100% and defaults time_remaining to "unknown"', (done) => {
    batteryStub.callsFake((cb) => cb({ percent: 100, isCharging: false }));

    mod.get_battery_status((err, data) => {
      expect(data.state).to.equal('charged');
      expect(data.time_remaining).to.equal('unknown');
      done();
    });
  });

  it('serves a second call from cache within the TTL (battery runs once)', (done) => {
    batteryStub.callsFake((cb) => cb({ percent: 55, isCharging: true, timeRemaining: 42 }));

    mod.get_battery_status(() => {
      mod.get_battery_status((err, data) => {
        expect(data.percentage_remaining).to.equal(55);
        expect(batteryStub.calledOnce).to.be.true;
        done();
      });
    });
  });

  it('re-queries after the TTL expires', (done) => {
    batteryStub.callsFake((cb) => cb({ percent: 55, isCharging: true, timeRemaining: 42 }));

    mod.get_battery_status(() => {
      clock.tick(60001); // TTL is 60000ms
      mod.get_battery_status(() => {
        expect(batteryStub.calledTwice).to.be.true;
        done();
      });
    });
  });

  it('bypasses the cache when bypassCache=true (battery runs each call)', (done) => {
    batteryStub.callsFake((cb) => cb({ percent: 55, isCharging: true, timeRemaining: 42 }));

    // Warm the cache with a normal call.
    mod.get_battery_status(() => {
      // Within the TTL, but bypassCache forces a fresh read.
      mod.get_battery_status({ bypassCache: true }, (err, data) => {
        expect(err).to.be.null;
        expect(data.percentage_remaining).to.equal(55);
        expect(batteryStub.calledTwice).to.be.true;
        done();
      });
    });
  });

  it('a bypass read refreshes the cache for later normal callers', (done) => {
    batteryStub.onFirstCall().callsFake((cb) => cb({ percent: 40, isCharging: false, timeRemaining: 100 }));
    batteryStub.onSecondCall().callsFake((cb) => cb({ percent: 90, isCharging: true, timeRemaining: 20 }));

    // Warm cache with the discharging reading.
    mod.get_battery_status((err, first) => {
      expect(first.state).to.equal('discharging');
      // Bypass read picks up the new charging state and rewrites the cache.
      mod.get_battery_status({ bypassCache: true }, () => {
        // Normal caller within the TTL now sees the refreshed value from cache.
        mod.get_battery_status((err2, cached) => {
          expect(cached.state).to.equal('charging');
          expect(cached.percentage_remaining).to.equal(90);
          expect(batteryStub.calledTwice).to.be.true;
          done();
        });
      });
    });
  });
});

describe('lib/agent/providers/indicators/windows get_remaining_storage', () => {
  let mod;
  let storageStub;

  beforeEach(() => {
    mod = rewire('../../../../../lib/agent/providers/indicators/windows');
    storageStub = sinon.stub();
    mod.__set__('getRemainingStorage', storageStub);
  });

  afterEach(() => sinon.restore());

  it('reports used as the percentage of total space consumed', (done) => {
    // 500GB total, 100GB free => 80% used.
    storageStub.callsFake((cb) => cb(null, 'Size          : 500\nFreeSpace     : 100'));

    mod.get_remaining_storage((err, info) => {
      expect(err).to.be.null;
      expect(info.total_gb).to.equal('500');
      expect(info.free_gb).to.equal('100');
      expect(info.used).to.equal(80);
      done();
    });
  });

  it('propagates errors from the underlying command', (done) => {
    const boom = new Error('powershell failed');
    storageStub.callsFake((cb) => cb(boom));

    mod.get_remaining_storage((err) => {
      expect(err).to.equal(boom);
      done();
    });
  });
});
