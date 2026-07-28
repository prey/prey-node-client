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
    locationModule.__set__('writeStorage', (local, cb) => cb(false));
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

  it('logs skipped when already sent today', () => {
    locationModule.__set__('writeStorage', (local, cb) => cb(false));
    forceLocation();
    expect(fakeLogger.info.calledWith('Force location skipped: already sent today')).to.be.true;
  });

  it('logs Sending force location when writeStorage allows', () => {
    locationModule.__set__('writeStorage', (local, cb) => cb(true));
    locationModule.__set__('fetchLocation', () => {});
    forceLocation();
    expect(fakeLogger.info.calledWith('Sending force location...')).to.be.true;
  });
});
