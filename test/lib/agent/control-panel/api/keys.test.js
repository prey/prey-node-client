const { expect } = require('chai');
const sinon = require('sinon');
const errors = require('../../../../../lib/agent/control-panel/api/errors');
const request = require('../../../../../lib/agent/control-panel/api/request');
const keys = require('../../../../../lib/agent/control-panel/api/keys');

describe('Keys Module', () => {
  let requestStub;

  beforeEach(() => {
    requestStub = sinon.stub(request, 'get');
    keys.unset('api');
    keys.unset('device');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('shoot function', () => {
    it('should call the callback with an error if provided', () => {
      const cb = sinon.spy();
      const error = new Error('Test error');
      keys.shoot(error, cb);
      expect(cb.calledOnceWith(error)).to.be.true;
    });

    it('should throw an error if no callback is provided', () => {
      const error = new Error('Test error');
      expect(() => keys.shoot(error)).to.throw('Test error');
    });
  });

  describe('verifyKeys function', () => {
    it('should call the callback if statusCode is 200', () => {
      const cb = sinon.spy();
      requestStub.callsFake((url, opts, callback) => callback(null, { statusCode: 200 }, null));

      keys.verify({ device: 'device-id', api: 'api-key' }, cb);

      expect(cb.calledOnce).to.be.true;
    });

    it('should return INVALID_DEVICE_KEY for statusCode 406 or 404', () => {
      const cb = sinon.spy();
      requestStub.callsFake((url, opts, callback) => callback(null, { statusCode: 404 }, null));
      keys.verify({ device: 'device-id', api: 'api-key' }, cb);
      const expectedError = errors.get('INVALID_DEVICE_KEY');
      expect(cb.calledOnceWith(sinon.match({ message: expectedError.message, code: expectedError.code }))).to.be.true;
    });    

    it('should return INVALID_CREDENTIALS for statusCode 401', () => {
      const cb = sinon.spy();
      requestStub.callsFake((url, opts, callback) => callback(null, { statusCode: 401 }, null));
      keys.verify({ device: 'device-id', api: 'api-key' }, cb);
      const expectedError = errors.get('INVALID_CREDENTIALS');
      expect(cb.calledOnceWith(sinon.match({ message: expectedError.message, code: expectedError.code }))).to.be.true;
    });

    it('should return an error for any other statusCode', () => {
      const cb = sinon.spy();
      requestStub.callsFake((url, opts, callback) => callback(null, { statusCode: 500 }, 'Server error'));

      keys.verify({ device: 'device-id', api: 'api-key' }, cb);

      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.include('Unable to verify keys');
    });
  });

  describe('present function', () => {
    it('should return true if both API and device keys are set', () => {
      keys.set({ api: 'api-key', device: 'device-id' });
      expect(keys.present()).to.be.true;
    });

    it('should return false if either API or device key is missing', () => {
      keys.unset('api');
      expect(keys.present()).to.be.false;
    });
  });

  describe('get function', () => {
    it('should return the keys object', () => {
      keys.set({ api: 'api-key', device: 'device-id' });
      const currkeys = keys.get();
      expect(currkeys.api).to.equal('api-key');
      expect(currkeys.device).to.equal('device-id');
    });
  });

  describe('set function', () => {
    it('should set the API and device keys', () => {
      const cb = sinon.spy();
      keys.set({ api: 'api-key', device: 'device-id' }, cb);

      const currkeys = keys.get();
      expect(currkeys.api).to.equal('api-key');
      expect(currkeys.device).to.equal('device-id');
      expect(cb.calledOnce).to.be.true;
    });
  });

  describe('verify function', () => {
    it('should verify the API and device keys', () => {
      const cb = sinon.spy();
      requestStub.callsFake((url, opts, callback) => callback(null, { statusCode: 200 }, null));
      keys.verify({ api: 'api-key', device: 'device-id' }, cb);
      expect(cb.calledOnce).to.be.true;
      expect(keys.get().api).to.equal('api-key');
      expect(keys.get().device).to.equal('device-id');
    });

    it('should return NO_API_KEY if API key is missing', () => {
      const cb = sinon.spy();
      keys.verify({ device: 'device-id' }, cb);
      const expectedError = errors.get('NO_API_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });
    

    it('should return NO_DEVICE_KEY if device key is missing', () => {
      const cb = sinon.spy();
      keys.verify({ api: 'api-key' }, cb);
      const expectedError = errors.get('NO_DEVICE_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });
  });

  describe('unset function', () => {
    it('should delete a key from the keys object', () => {
      keys.set({ api: 'api-key', device: 'device-id' });
      keys.unset('api');
      const currentKeys = keys.get();
      expect(currentKeys.api).to.be.undefined;
      expect(currentKeys.device).to.equal('device-id');
    });
  });
  
});
