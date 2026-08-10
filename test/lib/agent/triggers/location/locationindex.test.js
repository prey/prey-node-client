/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const storage = require('../../../../../lib/agent/utils/storage');
const config = require('../../../../../lib/utils/configfile');
const locationIndex = require('../../../../../lib/agent/triggers/location');

const SCHEDULE = {
  start_at: '07:00',
  end_at: '15:00',
  sunday: false,
  monday: true,
  tuesday: true,
  wednesday: true,
  thursday: true,
  friday: true,
  saturday: false,
};

describe('checkSchedule', () => {
  let clock;

  afterEach(() => {
    if (clock) clock.restore();
  });

  const withTime = (isoString) => {
    clock = sinon.useFakeTimers(new Date(isoString).getTime());
  };

  it('returns shouldSend false when today is not a scheduled day (Sunday)', () => {
    withTime('2025-01-05T10:00:00'); // Sunday
    const result = locationIndex.checkSchedule({ ...SCHEDULE, sunday: false });
    expect(result.shouldSend).to.be.false;
  });

  it('returns shouldSend false when current time is before start_at', () => {
    withTime('2025-01-06T06:30:00'); // Monday, 06:30 < 07:00
    const result = locationIndex.checkSchedule(SCHEDULE);
    expect(result.shouldSend).to.be.false;
  });

  it('returns shouldSend true when current time is within the window', () => {
    withTime('2025-01-06T10:00:00'); // Monday, 10:00 within 07:00-15:00
    const result = locationIndex.checkSchedule(SCHEDULE);
    expect(result.shouldSend).to.be.true;
  });

  it('returns shouldSend true at exactly start_at', () => {
    withTime('2025-01-06T07:00:00'); // Monday, exactly 07:00
    const result = locationIndex.checkSchedule(SCHEDULE);
    expect(result.shouldSend).to.be.true;
  });

  it('returns shouldSend true at exactly end_at', () => {
    withTime('2025-01-06T15:00:00'); // Monday, exactly 15:00
    const result = locationIndex.checkSchedule(SCHEDULE);
    expect(result.shouldSend).to.be.true;
  });

  it('returns shouldSend false when current time is past end_at', () => {
    withTime('2025-01-06T15:30:00'); // Monday, 15:30 > 15:00
    const result = locationIndex.checkSchedule(SCHEDULE);
    expect(result.shouldSend).to.be.false;
  });

  it('returns shouldSend false on Saturday even within hours', () => {
    withTime('2025-01-11T10:00:00'); // Saturday
    const result = locationIndex.checkSchedule({ ...SCHEDULE, saturday: false });
    expect(result.shouldSend).to.be.false;
  });

  it('returns shouldSend true for overnight window when time is after start', () => {
    withTime('2025-01-08T23:30:00'); // Wednesday, 23:30 inside 22:00–06:00
    const result = locationIndex.checkSchedule({ ...SCHEDULE, start_at: '22:00', end_at: '06:00' });
    expect(result.shouldSend).to.be.true;
  });

  it('returns shouldSend true for overnight window when time is before end', () => {
    withTime('2025-01-08T02:00:00'); // Wednesday, 02:00 inside 22:00–06:00
    const result = locationIndex.checkSchedule({ ...SCHEDULE, start_at: '22:00', end_at: '06:00' });
    expect(result.shouldSend).to.be.true;
  });

  it('returns shouldSend false for overnight window when time is in the gap', () => {
    withTime('2025-01-08T12:00:00'); // Wednesday, 12:00 outside 22:00–06:00
    const result = locationIndex.checkSchedule({ ...SCHEDULE, start_at: '22:00', end_at: '06:00' });
    expect(result.shouldSend).to.be.false;
  });

  it('returns shouldSend false when start_at is malformed', () => {
    withTime('2025-01-06T10:00:00'); // Monday
    const result = locationIndex.checkSchedule({ ...SCHEDULE, start_at: 'bad' });
    expect(result.shouldSend).to.be.false;
  });

  it('returns shouldSend false and logs warning when end_at is malformed', () => {
    withTime('2025-01-06T10:00:00'); // Monday
    const result = locationIndex.checkSchedule({ ...SCHEDULE, end_at: 'xx:yy' });
    expect(result.shouldSend).to.be.false;
  });
});

describe('stop', () => {
  let locationModule;
  let fakeConfig;

  beforeEach(() => {
    locationModule = rewire('../../../../../lib/agent/triggers/location');
    fakeConfig = {
      getData: sinon.stub().returns(null),
      onDataChange: sinon.stub(),
      offDataChange: sinon.stub(),
    };
    locationModule.__set__('config', fakeConfig);
  });

  it('clears the force interval on stop', () => {
    const fakeId = setInterval(() => {}, 999999);
    locationModule.__set__('forceIntervalId', fakeId);
    locationModule.stop();
    expect(locationModule.__get__('forceIntervalId')).to.be.null;
    clearInterval(fakeId); // cleanup in case stop didn't clear it
  });

  it('calls config.offDataChange for tracking_schedule on stop', () => {
    locationModule.stop();
    expect(fakeConfig.offDataChange.calledWith('control-panel.tracking_schedule')).to.be.true;
  });

  it('removes get_location_request hook on stop', () => {
    const fakeHooks = {
      on: sinon.stub(),
      remove: sinon.stub(),
      trigger: sinon.stub(),
    };
    locationModule.__set__('hooks', fakeHooks);
    locationModule.stop();
    expect(fakeHooks.remove.calledWith('get_location_request')).to.be.true;
  });
});

describe('writeStorage', () => {
  it('should recognize localtime to be newer in the machine', () => {
    const storageDoStub = sinon.stub(storage, 'do');
    storageDoStub.callsFake((operation, query, callback) => {
      callback(null, [
        {
          value: JSON.stringify({
            localDateTime: '2025-05-28T15:30:00.123Z',
            externalDateTime: '2025-05-31T15:30:00.123Z',
          }),
        },
      ]);
    });

    const local = '2025-05-29T15:30:00.123Z';
    locationIndex.writeStorage(local, (result) => {
      expect(result).to.be.true;
    });
    storageDoStub.restore();
  });

  it('should recognize localtime to be older in the machine', () => {
    const storageDoStub = sinon.stub(storage, 'do');
    storageDoStub.callsFake((operation, query, callback) => {
      callback(null, [
        {
          value: JSON.stringify({
            localDateTime: '2025-05-30T15:30:00.123Z',
            externalDateTime: '2025-05-31T15:30:00.123Z',
          }),
        },
      ]);
    });

    const local = '2025-05-29T15:30:00.123Z';
    locationIndex.writeStorage(local, (result) => {
      expect(result).to.be.false;
    });
    storageDoStub.restore();
  });
});

describe('checkOneDayDifference', () => {
  it('should return true if the greater date has a different day', () => {
    const fecha1 = new Date('2022-01-02');
    const fecha2 = new Date('2022-01-01');
    locationIndex.checkOneDayDifference(fecha1, fecha2, (result) => {
      expect(result).to.be.true;
    });
  });

  it('should return false if the greater date has the same day', () => {
    const fecha1 = new Date('2022-01-01');
    const fecha2 = new Date('2022-01-01');
    locationIndex.checkOneDayDifference(fecha1, fecha2, (result) => {
      expect(result).to.be.false;
    });
  });

  it('should return false if the dates are equal', () => {
    const fecha1 = new Date('2022-01-01');
    const fecha2 = new Date('2022-01-01');
    locationIndex.checkOneDayDifference(fecha1, fecha2, (result) => {
      expect(result).to.be.false;
    });
  });

  it('should throw an error if one of the dates is not a Date object', () => {
    const fecha1 = new Date('2022-01-01');
    const fecha2 = 'no es una fecha';
    expect(() => locationIndex.checkOneDayDifference(fecha1, fecha2)).to.throw(Error);
  });

  it('should throw an error if both dates are not Date objects', () => {
    const fecha1 = 'no es una fecha';
    const fecha2 = 'no es una fecha';
    expect(() => locationIndex.checkOneDayDifference(fecha1, fecha2)).to.throw(Error);
  });

  it('should return true when day-of-month matches but month is different (cross-month)', () => {
    locationIndex.checkOneDayDifference(
      new Date('2024-02-15'),
      new Date('2024-01-15'),
      (result) => {
        expect(result).to.be.true;
      }
    );
  });
});

describe('callFetchLocation', () => {
  let locationModule;
  let geoStub;
  let callFetchLocation;

  beforeEach(() => {
    locationModule = rewire('../../../../../lib/agent/triggers/location');
    geoStub = { fetch_location: sinon.stub() };
    locationModule.__set__('geo', geoStub);
    locationModule.__set__('emitter', {});
    callFetchLocation = locationModule.__get__('callFetchLocation');
  });

  it('accepts lat/lng as valid numbers and normalizes to strings', (done) => {
    geoStub.fetch_location.callsFake((cb) => cb(null, { lat: -33.456, lng: -70.648 }));
    callFetchLocation(
      (err) => done(err || new Error('done called unexpectedly')),
      (coords) => {
        expect(coords.lat).to.equal('-33.456');
        expect(coords.lng).to.equal('-70.648');
        done();
      }
    );
  });

  it('accepts lat/lng as valid strings and parses them', (done) => {
    geoStub.fetch_location.callsFake((cb) => cb(null, { lat: '-33.456', lng: '-70.648' }));
    callFetchLocation(
      (err) => done(err || new Error('done called unexpectedly')),
      (coords) => {
        expect(coords.lat).to.equal('-33.456');
        expect(coords.lng).to.equal('-70.648');
        done();
      }
    );
  });

  it('calls done with error when lat is a non-numeric string', (done) => {
    geoStub.fetch_location.callsFake((cb) => cb(null, { lat: 'not-a-number', lng: '-70.648' }));
    callFetchLocation(
      (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('Invalid coordinates');
        done();
      },
      () => done(new Error('cb should not be called'))
    );
  });

  it('calls done with error when lat is out of range (>90)', (done) => {
    geoStub.fetch_location.callsFake((cb) => cb(null, { lat: 91, lng: 0 }));
    callFetchLocation(
      (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('Invalid coordinates');
        done();
      },
      () => done(new Error('cb should not be called'))
    );
  });

  it('calls done with error when lng is out of range (>180)', (done) => {
    geoStub.fetch_location.callsFake((cb) => cb(null, { lat: 0, lng: 181 }));
    callFetchLocation(
      (err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.include('Invalid coordinates');
        done();
      },
      () => done(new Error('cb should not be called'))
    );
  });

  it('calls done with error when geo.fetch_location fails', (done) => {
    geoStub.fetch_location.callsFake((cb) => cb(new Error('GPS unavailable')));
    callFetchLocation(
      (err) => {
        expect(err).to.be.an.instanceOf(Error);
        done();
      },
      () => done(new Error('cb should not be called'))
    );
  });
});

describe('fetchLocation force - geoip rejection', () => {
  let locationModule;
  let geoStub;
  let fakeLogger;
  let fetchLocation;

  beforeEach(() => {
    locationModule = rewire('../../../../../lib/agent/triggers/location');
    geoStub = { fetch_location: sinon.stub() };
    fakeLogger = {
      warn: sinon.stub(),
      info: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      notice: sinon.stub(),
    };
    locationModule.__set__('geo', geoStub);
    locationModule.__set__('emitter', {});
    locationModule.__set__('logger', fakeLogger);
    fetchLocation = locationModule.__get__('fetchLocation');
  });

  it('rejects geoip result for force type and logs warning', () => {
    geoStub.fetch_location.callsFake((cb) => cb(null, { lat: -33.45, lng: -70.65, method: 'geoip' }));
    fetchLocation('force', () => {});
    expect(fakeLogger.warn.calledWith('Force location rejected: geoip result is not allowed')).to.be.true;
    expect(locationModule.__get__('checking')).to.be.false;
  });

  it('does not reject geoip result for interval type', () => {
    geoStub.fetch_location.callsFake((cb) => cb(null, { lat: -33.45, lng: -70.65, method: 'geoip', accuracy: 100 }));
    fetchLocation('interval', () => {});
    expect(fakeLogger.warn.calledWith('Force location rejected: geoip result is not allowed')).to.be.false;
  });

  it('does not reject wifi result for force type', () => {
    geoStub.fetch_location.callsFake((cb) => cb(null, { lat: -33.45, lng: -70.65, method: 'wifi', accuracy: 50 }));
    fetchLocation('force', () => {});
    expect(fakeLogger.warn.calledWith('Force location rejected: geoip result is not allowed')).to.be.false;
  });
});

describe('forceLocation - logging', () => {
  let locationModule;
  let fakeLogger;
  let fakeConfig;
  let forceLocation;

  beforeEach(() => {
    locationModule = rewire('../../../../../lib/agent/triggers/location');
    fakeLogger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      debug: sinon.stub(),
      error: sinon.stub(),
      notice: sinon.stub(),
    };
    fakeConfig = {
      getData: sinon.stub().returns(null),
      setData: sinon.stub(),
      onDataChange: sinon.stub(),
      offDataChange: sinon.stub(),
    };
    locationModule.__set__('logger', fakeLogger);
    locationModule.__set__('config', fakeConfig);
    forceLocation = locationModule.__get__('forceLocation');
  });

  it('logs Force location check triggered on every call', () => {
    forceLocation();
    expect(fakeLogger.info.calledWith('Force location check triggered')).to.be.true;
  });

  it('logs skipped when outside tracking schedule window', () => {
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns({
      start_at: '09:00',
      end_at: '17:00',
      monday: false,
      tuesday: false,
      wednesday: false,
      thursday: false,
      friday: false,
      saturday: false,
      sunday: false,
    });
    forceLocation();
    expect(fakeLogger.info.calledWith('Force location skipped: outside tracking schedule window')).to.be.true;
  });

  it('logs skipped when no schedule and location_aware is false', () => {
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(null);
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(false);
    const fetchLocationSpy = sinon.stub();
    locationModule.__set__('fetchLocation', fetchLocationSpy);
    forceLocation();
    expect(fakeLogger.info.calledWith('Force location skipped: no schedule and location_aware is false')).to.be.true;
    expect(fetchLocationSpy.called).to.be.false;
  });

  it('logs skipped when already sent today', () => {
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(true);
    locationModule.__set__('writeStorage', (local, cb) => cb(false, false));
    forceLocation();
    expect(fakeLogger.info.calledWith('Force location skipped: already sent today')).to.be.true;
  });

  it('logs Sending force location when writeStorage allows', () => {
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(true);
    locationModule.__set__('writeStorage', (local, cb) => cb(true, false));
    locationModule.__set__('fetchLocation', () => {});
    forceLocation();
    expect(fakeLogger.info.calledWith('Sending force location...')).to.be.true;
  });
});

describe('isValidSchedule', () => {
  it('returns false for null', () => {
    expect(locationIndex.isValidSchedule(null)).to.be.false;
  });

  it('returns false for undefined', () => {
    expect(locationIndex.isValidSchedule(undefined)).to.be.false;
  });

  it('returns false for empty object {}', () => {
    expect(locationIndex.isValidSchedule({})).to.be.false;
  });

  it('returns false for an array', () => {
    expect(locationIndex.isValidSchedule([1, 2, 3])).to.be.false;
  });

  it('returns false for a string', () => {
    expect(locationIndex.isValidSchedule('09:00')).to.be.false;
  });

  it('returns true for a non-empty schedule object', () => {
    expect(locationIndex.isValidSchedule(SCHEDULE)).to.be.true;
  });

  it('returns true for a schedule with only one key', () => {
    expect(locationIndex.isValidSchedule({ start_at: '09:00' })).to.be.true;
  });
});

describe('sendLocation - force type', () => {
  let locationModule;
  let fakeConfig;
  let postItStub;
  let sendLocation;

  const validSchedule = { start_at: '09:00', end_at: '17:00', monday: true };
  const mockLocation = { lat: '-33.45', lng: '-70.65' };

  beforeEach(() => {
    locationModule = rewire('../../../../../lib/agent/triggers/location');
    fakeConfig = {
      getData: sinon.stub().returns(null),
      onDataChange: sinon.stub(),
      offDataChange: sinon.stub(),
    };
    postItStub = sinon.stub();
    locationModule.__set__('config', fakeConfig);
    locationModule.__set__('postIt', postItStub);
    sendLocation = locationModule.__get__('sendLocation');
  });

  it('calls postIt when location_aware is true (any type)', () => {
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(true);
    sendLocation('force', mockLocation);
    expect(postItStub.calledOnce).to.be.true;
  });

  it('calls postIt when location_aware is false, type is force, and schedule is valid', () => {
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(false);
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(validSchedule);
    sendLocation('force', mockLocation);
    expect(postItStub.calledOnce).to.be.true;
  });

  it('does not call postIt when location_aware is false, type is force, and schedule is null', () => {
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(false);
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(null);
    sendLocation('force', mockLocation);
    expect(postItStub.called).to.be.false;
  });

  it('does not call postIt when location_aware is false, type is force, and schedule is {}', () => {
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(false);
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns({});
    sendLocation('force', mockLocation);
    expect(postItStub.called).to.be.false;
  });

  it('does not fire the callback when force send is skipped due to missing schedule', () => {
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(false);
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(null);
    const cb = sinon.stub();
    sendLocation('force', mockLocation, cb);
    expect(cb.called).to.be.false;
  });

  it('passes the callback to postIt when force send is allowed', () => {
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(false);
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(validSchedule);
    const cb = sinon.stub();
    sendLocation('force', mockLocation, cb);
    expect(postItStub.calledWith(sinon.match.object, cb)).to.be.true;
  });
});

describe('writeStorage - no entry case', () => {
  it('calls cb(true, true) when no entry exists and does not write to storage', () => {
    const storageDoStub = sinon.stub(storage, 'do');
    storageDoStub.callsFake((operation, query, callback) => {
      callback(null, []); // no stored entry
    });

    locationIndex.writeStorage('2026-08-04T10:00:00.000Z', (canSend, isFirstTime) => {
      expect(canSend).to.be.true;
      expect(isFirstTime).to.be.true;
      // storage.do should only have been called once (the read query), not a second time for 'set'
      expect(storageDoStub.callCount).to.equal(1);
    });

    storageDoStub.restore();
  });

  it('calls cb(false, false) when storage query errors', () => {
    const storageDoStub = sinon.stub(storage, 'do');
    storageDoStub.callsFake((operation, query, callback) => {
      callback(new Error('db error'));
    });

    locationIndex.writeStorage('2026-08-04T10:00:00.000Z', (canSend, isFirstTime) => {
      expect(canSend).to.be.false;
      expect(isFirstTime).to.be.false;
    });

    storageDoStub.restore();
  });

  it('calls cb(true, false) when entry exists and day has passed', () => {
    const storageDoStub = sinon.stub(storage, 'do');
    storageDoStub.callsFake((operation, query, callback) => {
      callback(null, [{ value: JSON.stringify({ localDateTime: '2026-08-03T10:00:00.000Z' }) }]);
    });

    locationIndex.writeStorage('2026-08-04T10:00:00.000Z', (canSend, isFirstTime) => {
      expect(canSend).to.be.true;
      expect(isFirstTime).to.be.false;
    });

    storageDoStub.restore();
  });

  it('calls cb(false, false) when entry exists and same day', () => {
    const storageDoStub = sinon.stub(storage, 'do');
    storageDoStub.callsFake((operation, query, callback) => {
      callback(null, [{ value: JSON.stringify({ localDateTime: '2026-08-04T08:00:00.000Z' }) }]);
    });

    locationIndex.writeStorage('2026-08-04T10:00:00.000Z', (canSend, isFirstTime) => {
      expect(canSend).to.be.false;
      expect(isFirstTime).to.be.false;
    });

    storageDoStub.restore();
  });
});

describe('forceLocation - storeForceData after confirmed success', () => {
  let locationModule;
  let fakeLogger;
  let fakeConfig;
  let storageDoStub;
  let forceLocation;

  beforeEach(() => {
    locationModule = rewire('../../../../../lib/agent/triggers/location');
    fakeLogger = {
      info: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(),
      error: sinon.stub(), notice: sinon.stub(),
    };
    fakeConfig = {
      getData: sinon.stub().returns(null),
      setData: sinon.stub(),
      onDataChange: sinon.stub(),
      offDataChange: sinon.stub(),
    };
    // location_aware=true avoids the Fix-2 early-return (no schedule + location_aware=false)
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(true);
    storageDoStub = sinon.stub(storage, 'do');
    locationModule.__set__('logger', fakeLogger);
    locationModule.__set__('config', fakeConfig);
    forceLocation = locationModule.__get__('forceLocation');
  });

  afterEach(() => {
    storageDoStub.restore();
  });

  it('calls storage.do with set when isFirstTime=true and fetchLocation succeeds', () => {
    locationModule.__set__('writeStorage', (local, cb) => cb(true, true));
    locationModule.__set__('fetchLocation', (type, cb) => cb(null));
    storageDoStub.callsFake((op, query, cb) => cb(null));

    forceLocation();

    expect(storageDoStub.calledOnce).to.be.true;
    expect(storageDoStub.firstCall.args[0]).to.equal('set');
  });

  it('calls storage.do with update when isFirstTime=false and fetchLocation succeeds', () => {
    locationModule.__set__('writeStorage', (local, cb) => cb(true, false));
    locationModule.__set__('fetchLocation', (type, cb) => cb(null));
    storageDoStub.callsFake((op, query, cb) => cb(null));

    forceLocation();

    expect(storageDoStub.calledOnce).to.be.true;
    expect(storageDoStub.firstCall.args[0]).to.equal('update');
  });

  it('does not call storage.do when fetchLocation fails', () => {
    locationModule.__set__('writeStorage', (local, cb) => cb(true, true));
    locationModule.__set__('fetchLocation', (type, cb) => cb(new Error('gps failed')));

    forceLocation();

    expect(storageDoStub.called).to.be.false;
  });

  it('logs error when storage.do fails (storeForceData error path)', () => {
    locationModule.__set__('writeStorage', (local, cb) => cb(true, false));
    locationModule.__set__('fetchLocation', (type, cb) => cb(null));
    storageDoStub.callsFake((op, query, cb) => cb(new Error('sqlite write failed')));

    forceLocation();

    expect(storageDoStub.calledOnce).to.be.true;
    expect(fakeLogger.error.calledWith('Unable to update db keys last force location values')).to.be.true;
    expect(fakeLogger.info.calledWith('Updated db keys last force location values')).to.be.false;
  });
});

describe('forceLocation - last_force_datetime only written after HTTP 200', () => {
  // These tests exercise the real fetchLocation → sendLocation → postIt chain.
  // Only geo.fetch_location and devices.post_location are mocked (the HTTP boundary).
  // This verifies that storeForceData is triggered by a 200 response, not by a
  // successful location fetch alone.
  let locationModule;
  let fakeConfig;
  let fakeGeo;
  let fakeStorage;
  let forceLocation;

  beforeEach(() => {
    locationModule = rewire('../../../../../lib/agent/triggers/location');

    fakeConfig = {
      getData: sinon.stub().returns(null),
      setData: sinon.stub(),
      onDataChange: sinon.stub(),
      offDataChange: sinon.stub(),
    };
    // location_aware=true → sendLocation calls postIt directly without an API roundtrip
    fakeConfig.getData.withArgs('control-panel.location_aware').returns(true);

    fakeGeo = {
      fetch_location: sinon.stub().callsFake((cb) => cb(null, {
        lat: -33.45, lng: -70.65, method: 'wifi', accuracy: 50,
      })),
    };

    fakeStorage = { do: sinon.stub() };

    locationModule.__set__('config', fakeConfig);
    locationModule.__set__('geo', fakeGeo);
    locationModule.__set__('emitter', {});
    locationModule.__set__('storage', fakeStorage);
    locationModule.__set__('exceptions', { send: sinon.stub() });
    locationModule.__set__('logger', {
      info: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(),
      error: sinon.stub(), notice: sinon.stub(),
    });
    // Allow send, signal first-time so storeOp would be 'set'
    locationModule.__set__('writeStorage', (local, cb) => cb(true, true));

    forceLocation = locationModule.__get__('forceLocation');
  });

  it('writes last_force_datetime when devices.post_location responds with 200', () => {
    locationModule.__set__('devices', {
      post_location: sinon.stub().callsFake((data, cb) => cb(null, true)), // HTTP 200
      get: { status: sinon.stub() },
    });
    fakeStorage.do.callsFake((op, query, cb) => cb(null));

    forceLocation();

    expect(fakeStorage.do.calledOnce).to.be.true;
    expect(fakeStorage.do.firstCall.args[0]).to.equal('set');
  });

  it('does not write last_force_datetime when devices.post_location returns an error', () => {
    locationModule.__set__('devices', {
      post_location: sinon.stub().callsFake((data, cb) => cb(new Error('HTTP 500'))),
      get: { status: sinon.stub() },
    });

    forceLocation();

    expect(fakeStorage.do.called).to.be.false;
  });
});

describe('calculateWindowDurationMinutes', () => {
  it('returns correct duration for a non-overnight window (09:00–17:00)', () => {
    const result = locationIndex.calculateWindowDurationMinutes({ start_at: '09:00', end_at: '17:00' });
    expect(result).to.equal(480);
  });

  it('returns correct duration for an overnight window (22:00–06:00)', () => {
    const result = locationIndex.calculateWindowDurationMinutes({ start_at: '22:00', end_at: '06:00' });
    expect(result).to.equal(480);
  });

  it('returns correct duration for a short window (09:00–09:30)', () => {
    const result = locationIndex.calculateWindowDurationMinutes({ start_at: '09:00', end_at: '09:30' });
    expect(result).to.equal(30);
  });

  it('returns 0 for a zero-duration window (same start and end)', () => {
    const result = locationIndex.calculateWindowDurationMinutes({ start_at: '09:00', end_at: '09:00' });
    expect(result).to.equal(0);
  });
});

describe('calculateForceIntervalMs', () => {
  it('caps interval at 20 min for an 8h window (raw/3 = 160 min exceeds cap)', () => {
    const result = locationIndex.calculateForceIntervalMs({ start_at: '09:00', end_at: '17:00' });
    expect(result).to.equal(20 * 60 * 1000);
  });

  it('returns 10 min for a 30-min window (between floor and cap)', () => {
    const result = locationIndex.calculateForceIntervalMs({ start_at: '09:00', end_at: '09:30' });
    expect(result).to.equal(10 * 60 * 1000);
  });

  it('enforces the 2-minute minimum for a very short window (4 min)', () => {
    const result = locationIndex.calculateForceIntervalMs({ start_at: '09:00', end_at: '09:04' });
    expect(result).to.equal(2 * 60 * 1000);
  });

  it('enforces the 2-minute minimum when window duration is 0', () => {
    const result = locationIndex.calculateForceIntervalMs({ start_at: '09:00', end_at: '09:00' });
    expect(result).to.equal(2 * 60 * 1000);
  });
});

describe('msUntilNextWindowStart', () => {
  let clock;

  afterEach(() => {
    if (clock) { clock.restore(); clock = null; }
  });

  it('returns ms until start_at today when start has not passed yet', () => {
    // Monday 08:00, schedule Mon 09:00–17:00
    clock = sinon.useFakeTimers(new Date('2025-01-06T08:00:00').getTime());
    const schedule = { ...SCHEDULE, start_at: '09:00', end_at: '17:00' };
    const result = locationIndex.msUntilNextWindowStart(schedule, new Date());
    expect(result).to.equal(60 * 60 * 1000); // 60 min
  });

  it('skips today when start_at has already passed and returns ms for next enabled day', () => {
    // Monday 18:00 (window 09:00–17:00 already closed)
    clock = sinon.useFakeTimers(new Date('2025-01-06T18:00:00').getTime());
    const schedule = { ...SCHEDULE, start_at: '09:00', end_at: '17:00' };
    // Next enabled day: Tuesday 09:00 = 15h away
    const result = locationIndex.msUntilNextWindowStart(schedule, new Date());
    expect(result).to.equal(15 * 60 * 60 * 1000);
  });

  it('returns null when no day is enabled', () => {
    clock = sinon.useFakeTimers(new Date('2025-01-06T10:00:00').getTime());
    const noDay = {
      start_at: '09:00', end_at: '17:00',
      sunday: false, monday: false, tuesday: false,
      wednesday: false, thursday: false, friday: false, saturday: false,
    };
    const result = locationIndex.msUntilNextWindowStart(noDay, new Date());
    expect(result).to.be.null;
  });

  it('returns ms until start_at today for overnight window when between window-end and window-start', () => {
    // Wednesday 10:00, overnight window 22:00–06:00 (outside: between 06:00 and 22:00)
    clock = sinon.useFakeTimers(new Date('2025-01-08T10:00:00').getTime());
    const schedule = { ...SCHEDULE, start_at: '22:00', end_at: '06:00' };
    const result = locationIndex.msUntilNextWindowStart(schedule, new Date());
    expect(result).to.equal(12 * 60 * 60 * 1000); // 12h until 22:00
  });
});

describe('msUntilWindowEnd', () => {
  let clock;

  afterEach(() => {
    if (clock) { clock.restore(); clock = null; }
  });

  it('returns ms until end_at for a non-overnight window', () => {
    // 10:00, window 09:00–17:00
    clock = sinon.useFakeTimers(new Date('2025-01-06T10:00:00').getTime());
    const schedule = { start_at: '09:00', end_at: '17:00' };
    const result = locationIndex.msUntilWindowEnd(schedule, new Date());
    expect(result).to.equal(7 * 60 * 60 * 1000); // 7h
  });

  it('returns ms until end_at tomorrow for overnight window (past start)', () => {
    // 23:00, window 22:00–06:00 (past start → end is tomorrow)
    clock = sinon.useFakeTimers(new Date('2025-01-06T23:00:00').getTime());
    const schedule = { start_at: '22:00', end_at: '06:00' };
    const result = locationIndex.msUntilWindowEnd(schedule, new Date());
    expect(result).to.equal(7 * 60 * 60 * 1000); // 7h until tomorrow 06:00
  });

  it('returns ms until end_at today for overnight window (before end)', () => {
    // 03:00, window 22:00–06:00 (before end → end is today)
    clock = sinon.useFakeTimers(new Date('2025-01-07T03:00:00').getTime());
    const schedule = { start_at: '22:00', end_at: '06:00' };
    const result = locationIndex.msUntilWindowEnd(schedule, new Date());
    expect(result).to.equal(3 * 60 * 60 * 1000); // 3h
  });
});

// Fake timers must be installed BEFORE rewire so that the module's new Date() uses the fake clock.
// Per-test time adjustments use clock.setSystemTime() to avoid reinstalling timers.
describe('restartForceInterval - scheduling behavior', () => {
  let locationModule;
  let fakeConfig;
  let clock;

  beforeEach(() => {
    // Use Wednesday 08:00 as a safe "outside window" default so module initializes cleanly
    clock = sinon.useFakeTimers(new Date('2025-01-08T08:00:00').getTime());
    locationModule = rewire('../../../../../lib/agent/triggers/location');
    fakeConfig = {
      getData: sinon.stub().returns(null),
      onDataChange: sinon.stub(),
      offDataChange: sinon.stub(),
    };
    locationModule.__set__('config', fakeConfig);
    locationModule.__set__('logger', {
      info: sinon.stub(), warn: sinon.stub(), debug: sinon.stub(),
      error: sinon.stub(), notice: sinon.stub(),
    });
  });

  afterEach(() => {
    locationModule.__get__('clearForceTimers')();
    if (clock) { clock.restore(); clock = null; }
  });

  it('uses 45-min interval when no schedule is configured', () => {
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(null);
    locationModule.__get__('restartForceInterval')();
    // No schedule → setInterval with fallback 45-min delay, no window timeout
    expect(locationModule.__get__('forceIntervalId')).to.not.be.null;
    expect(locationModule.__get__('forceTimeoutId')).to.be.null;
  });

  it('fires forceLocation immediately when already inside the window', () => {
    // Advance to Wednesday 10:00 — inside SCHEDULE window 07:00–15:00
    clock.setSystemTime(new Date('2025-01-08T10:00:00').getTime());
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(SCHEDULE);
    locationModule.__get__('restartForceInterval')();
    // Inside window: scheduleForceInWindow sets a repeat interval + a window-end timeout
    expect(locationModule.__get__('forceIntervalId')).to.not.be.null;
    expect(locationModule.__get__('forceTimeoutId')).to.not.be.null;
  });

  it('does not start the interval when outside the window', () => {
    // Advance to Wednesday 20:00 — outside SCHEDULE window 07:00–15:00
    clock.setSystemTime(new Date('2025-01-08T20:00:00').getTime());
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(SCHEDULE);
    locationModule.__get__('restartForceInterval')();
    // Outside window: only a timeout to next window start, no interval yet
    expect(locationModule.__get__('forceIntervalId')).to.be.null;
    expect(locationModule.__get__('forceTimeoutId')).to.not.be.null;
  });

  it('schedules interval at window start when currently outside', () => {
    // Start at Wednesday 08:00, 1h before SCHEDULE window opens at 07:00
    // (beforeEach already sets clock to 08:00 — window starts at 07:00 which already passed,
    //  so next window is next day at 07:00)
    // Use 06:00 instead: 1h before 07:00
    clock.setSystemTime(new Date('2025-01-08T06:00:00').getTime());
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(SCHEDULE);
    locationModule.__get__('restartForceInterval')();
    expect(locationModule.__get__('forceIntervalId')).to.be.null;
    expect(locationModule.__get__('forceTimeoutId')).to.not.be.null;
    clock.tick(60 * 60 * 1000); // advance 1h to 07:00 — window opens
    // After window opens: scheduleForceInWindow was called → interval is now set
    expect(locationModule.__get__('forceIntervalId')).to.not.be.null;
  });

  it('stop clears both forceIntervalId and forceTimeoutId', () => {
    // Outside window: sets a timeout, no interval
    clock.setSystemTime(new Date('2025-01-08T20:00:00').getTime());
    fakeConfig.getData.withArgs('control-panel.tracking_schedule').returns(SCHEDULE);
    locationModule.__get__('restartForceInterval')();
    locationModule.__get__('clearForceTimers')();
    expect(locationModule.__get__('forceIntervalId')).to.be.null;
    expect(locationModule.__get__('forceTimeoutId')).to.be.null;
  });
});
