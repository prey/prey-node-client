/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
// test/lib/utils/configutil.test.js
const chai = require('chai');
const sinon = require('sinon');

const { expect } = chai;
const configutil = require('../../../lib/utils/configutil');
const storage = require('../../../lib/agent/utils/storage');

describe('configutil test', () => {
  describe('getDataDbKey', () => {
    it('should get data from database', (done) => {
      const whatToGet = 'test-key';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb(null, [{ id: 1, value: 'test-value' }]);
      });
      configutil.getDataDbKey(whatToGet, callback);
      expect(callback.calledWith(null, [{ id: 1, value: 'test-value' }])).to.be.true;
      storageStub.restore();
      done();
    });

    it('should handle error when getting data from database', (done) => {
      const whatToGet = 'test-key';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb(new Error('Error getting data'));
      });
      configutil.getDataDbKey(whatToGet, callback);
      expect(callback.calledWith(sinon.match.instanceOf(Error))).to.be.true;
      storageStub.restore();
      done();
    });
  });

  describe('setKey', () => {
    it('should set a value in the database', (done) => {
      const whatToGet = 'test-key';
      const valuetoSet = 'test-value';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb();
      });
      configutil.setKey(whatToGet, valuetoSet, callback);
      expect(callback.called).to.be.true;
      storageStub.restore();
      done();
    });
  });

  describe('updateKey', () => {
    it('should update a value in the database', (done) => {
      const whatToGet = 'test-key';
      const valuetoSet = 'new-test-value';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb();
      });
      configutil.updateKey(whatToGet, valuetoSet, callback);
      expect(callback.called).to.be.true;
      storageStub.restore();
      done();
    });
  });

  describe('saveToDbKey', () => {
    it('should save a value to the database', (done) => {
      const whatToGet = 'test-key';
      const valuetoSet = 'test-value';
      const callback = sinon.stub();
      const storageStub = sinon.stub(storage, 'do');
      storageStub.callsFake((method, params, cb) => {
        cb();
      });
      configutil.saveToDbKey(whatToGet, valuetoSet, callback);
      expect(callback.called).to.be.true;
      storageStub.restore();
      done();
    });
  });
});
