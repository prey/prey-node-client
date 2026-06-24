/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const { expect } = require('chai');
const sinon = require('sinon');
const rewire = require('rewire');
const storage = require('../../../../../lib/agent/utils/storage');
const locationIndex = require('../../../../../lib/agent/triggers/location'); // Asumo que la función está en un archivo llamado locationIndex.js

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
