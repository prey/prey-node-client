const { expect } = require('chai');
const sinon = require('sinon');
const storage = require('../../../../../lib/agent/utils/storage.js');
const { saveDataWifi, retrieveDataWifi } = require('../../../../../lib/agent/utils/storage/utilstorage');
describe('WiFi Data Module', () => {
  let storageDoStub;

  beforeEach(() => {
    storageDoStub = sinon.stub(storage, 'do');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('saveDataWifi function', () => {
    it('should update existing WiFi data if stored data exists', () => {
      const mockDataWifi = { ssid: 'TestWiFi', signal: -50 };
      const storedData = JSON.stringify({ dataWifi: [{ ssid: 'OldWiFi', signal: -60 }] });

      storageDoStub
        .onFirstCall()
        .callsFake((operation, query, callback) => {
          expect(operation).to.equal('query');
          callback(null, [{ value: storedData }]);
        })
        .onSecondCall()
        .callsFake((operation, updateData, callback) => {
          expect(operation).to.equal('update');
          const updatedData = JSON.parse(updateData.values);
          expect(updatedData.dataWifi).to.have.lengthOf(2);
          expect(updatedData.dataWifi[1]).to.deep.equal(mockDataWifi);
          callback(null);
        });

      saveDataWifi(mockDataWifi);
      expect(storageDoStub.calledTwice).to.be.true;
    });

    it('should trim WiFi data to 200 entries if it exceeds the limit', () => {
      const mockDataWifi = { ssid: 'WiFi200', signal: -50 };
      const largeDataWifi = Array.from({ length: 201 }, (_, i) => ({ ssid: `WiFi${i}`, signal: -50 }));

      const storedData = JSON.stringify({ dataWifi: largeDataWifi });

      storageDoStub
        .onFirstCall()
        .callsFake((operation, query, callback) => {
          callback(null, [{ value: storedData }]);
        })
        .onSecondCall()
        .callsFake((operation, updateData, callback) => {
          const updatedData = JSON.parse(updateData.values);
          expect(updatedData.dataWifi).to.have.lengthOf(201);
          expect(updatedData.dataWifi[199]).to.deep.equal(mockDataWifi);
          callback(null);
        });

      saveDataWifi(mockDataWifi);
      expect(storageDoStub.calledTwice).to.be.true;
    });

    it('should create new WiFi data if no stored data exists', () => {
      const mockDataWifi = { ssid: 'TestWiFi', signal: -50 };

      storageDoStub
        .onFirstCall()
        .callsFake((operation, query, callback) => {
          expect(operation).to.equal('query');
          callback(null, []);
        })
        .onSecondCall()
        .callsFake((operation, setData, callback) => {
          expect(operation).to.equal('set');
          const newData = JSON.parse(setData.data.value);
          expect(newData.dataWifi).to.deep.equal([mockDataWifi]);
          callback(null);
        });

      saveDataWifi(mockDataWifi);
      expect(storageDoStub.calledTwice).to.be.true;
    });
  });

  describe('retrieveDataWifi function', () => {
    it('should return stored WiFi data if it exists', (done) => {
      const storedData = JSON.stringify({ dataWifi: [{ ssid: 'TestWiFi', signal: -50 }] });

      storageDoStub.callsFake((operation, query, callback) => {
        expect(operation).to.equal('query');
        callback(null, [{ value: storedData }]);
      });

      retrieveDataWifi((result) => {
        expect(result).to.equal(storedData);
        done();
      });
    });

    it('should return an empty string if no stored data exists', (done) => {
      storageDoStub.callsFake((operation, query, callback) => {
        expect(operation).to.equal('query');
        callback(null, []);
      });

      retrieveDataWifi((result) => {
        expect(result).to.equal('');
        done();
      });
    });

    it('should return an empty string if an error occurs', (done) => {
      storageDoStub.callsFake((operation, query, callback) => {
        expect(operation).to.equal('query');
        callback(new Error('Database error'));
      });

      retrieveDataWifi((result) => {
        expect(result).to.equal('');
        done();
      });
    });
  });
});
