/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const { expect } = require('chai');
const sinon = require('sinon');
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
