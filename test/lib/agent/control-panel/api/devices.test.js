const { expect } = require('chai');
const sinon = require('sinon');
const keys = require('../../../../../lib/agent/control-panel/api/keys');
const errors = require('../../../../../lib/agent/control-panel/api/errors');
const request = require('../../../../../lib/agent/control-panel/api/request');
const devices = require('../../../../../lib/agent/control-panel/api/devices');

describe('Devices', () => {
  let requestPostStub;
  let requestDeleteStub;
  let keysStubGet;
  let devicesSetStub;
  let keysSetStub;

  beforeEach(() => {
    requestPostStub = sinon.stub(request, 'post');
    requestDeleteStub = sinon.stub(request, 'delete');
    sinon.stub(request, 'get');
    keysStubGet = sinon.stub(keys, 'get').returns({ api: 'api-key', device: null });
    keysSetStub = sinon.stub(keys, 'set');
    sinon.stub(keys, 'unset');
    devicesSetStub =  sinon.stub(devices, 'set');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('set function', () => {
    it('should throw an error if no key is provided (null)', () => {
      expect(() => devices.set(null)).to.throw('No key!');
    });
  
    it('should throw an error if no key is provided (undefined)', () => {
      expect(() => devices.set(undefined)).to.throw('No key!');
    });
  
    it('should throw an error if an empty string is provided', () => {
      expect(() => devices.set('')).to.throw('No key!');
    });
  
    it('should throw an error if false is provided', () => {
      expect(() => devices.set(false)).to.throw('No key!');
    });
  
    it('should set the device key correctly for a valid key', () => {
      const key = 'device-key';
      const result = devices.set(key);
      expect(result).to.equal(key);
      expect(keysSetStub.calledOnceWith({ device: key })).to.be.true;
    });
  
    it('should set the device key for a numeric key', () => {
      const key = 12345;
      const result = devices.set(key);
      expect(result).to.equal(key);
      expect(keysSetStub.calledOnceWith({ device: key })).to.be.true;
    });
  
    it('should set the device key for a boolean true key', () => {
      const key = true; 
      const result = devices.set(key);
      expect(result).to.equal(true); 
      expect(keysSetStub.calledOnceWith({ device: key })).to.be.true;
    });
  
    it('should set the device key for an object key', () => {
      const key = { id: '123' };
      const result = devices.set(key);
      expect(result).to.equal(key);
      expect(keysSetStub.calledOnceWith({ device: key })).to.be.true;
    });
  
    it('should set the device key for an array key', () => {
      const key = ['key1', 'key2'];
      const result = devices.set(key);
      expect(result).to.equal(key);
      expect(keysSetStub.calledOnceWith({ device: key })).to.be.true;
    });
  });

  describe('link function', () => {
    it('should call callback with null and set the device key if body.key exists', () => {
      const cb = sinon.spy();
      const fakeBody = { key: 'new-device-key' };
  
      requestPostStub.callsFake((url, data, opts, callback) => {
        callback(null, { body: fakeBody });
      });
  
      devices.link({ someData: true }, cb);
  
      expect(cb.calledOnce).to.be.true;
      expect(devicesSetStub.calledOnceWith('new-device-key')).to.be.true;
      expect(cb.args[0][0]).to.equal(null);
    });
  
    it('should call callback with INVALID_CREDENTIALS if statusCode is 401', () => {
      const cb = sinon.spy();
  
      requestPostStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 401 });
      });
  
      devices.link({ someData: true }, cb);
  
      const expectedError = errors.get('INVALID_CREDENTIALS');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });
  
    it('should call callback with NO_AVAILABLE_SLOTS if statusCode is 302', () => {
      const cb = sinon.spy();
  
      requestPostStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 302 });
      });
  
      devices.link({ someData: true }, cb);
  
      const expectedError = errors.get('NO_AVAILABLE_SLOTS');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });
  
    it('should call callback with NO_AVAILABLE_SLOTS if statusCode is 403', () => {
      const cb = sinon.spy();
  
      requestPostStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 403 });
      });
  
      devices.link({ someData: true }, cb);
  
      const expectedError = errors.get('NO_AVAILABLE_SLOTS');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });
  
    it('should call callback with unprocessable error if statusCode is 422', () => {
      const cb = sinon.spy();
      const fakeBody = { errors: { name: ['Name is required'] } };
  
      requestPostStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 422, body: fakeBody });
      });
  
      devices.link({ someData: true }, cb);
  
      const expectedError = errors.unprocessable(fakeBody);
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
    });
  
    it('should call callback with unprocessable error if body contains errors', () => {
      const cb = sinon.spy();
      const fakeBody = { errors: { name: ['Name is required'] } };
  
      requestPostStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 200, body: fakeBody });
      });
  
      devices.link({ someData: true }, cb);
  
      const expectedError = errors.unprocessable(fakeBody);
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
    });
  
    it('should call callback with unknown error for an unknown status', () => {
      const cb = sinon.spy();
  
      requestPostStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 500 });
      });
  
      devices.link({ someData: true }, cb);
  
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0]).to.be.instanceOf(Error);
      expect(cb.args[0][0].message).to.include('500');
    });

    it('should return an error if data is missing', () => {
      const cb = sinon.spy();
      devices.link({}, cb);
      
      const expectedError = errors.arguments('Empty data.');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
    });

    it('should return an error if the device key is already set', () => {
      keysStubGet.returns({ api: 'api-key', device: 'device-id' });
      const cb = sinon.spy();
      devices.link({ data: true }, cb);
      
      const expectedError = errors.get('DEVICE_KEY_SET');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });

    it('should return an error if no API key is set', () => {
      keysStubGet.returns({ api: null, device: null });
      const cb = sinon.spy();
      devices.link({ data: true }, cb);
      
      const expectedError = errors.get('NO_API_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });

    it('should handle a successful response and set the device key', () => {
      requestPostStub.callsFake((url, data, opts, cb) => cb(null, { body: { key: 'new-device-key' } }));
      const cb = sinon.spy();
      
      devices.link({ data: true }, cb);
      
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0]).to.equal(null); // No error
      expect(cb.args[0][1]).to.equal('new-device-key'); // New device key returned
      expect(keys.set.calledWith({ device: 'new-device-key' })).to.be.true;
    });
  });

  describe('unlink function', () => {
    it('should return an error if keys are missing', () => {
      keysStubGet.returns({ api: null, device: null });

      const cb = sinon.spy();
      devices.unlink(cb);

      const expectedError = errors.get('MISSING_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });

    it('should successfully unset the device key on 200 response', () => {
      requestDeleteStub.callsFake((url, opts, cb) => cb(null, { statusCode: 200 }));
      keysStubGet.returns({ api: 'api-key', device: 'device-id' });

      const cb = sinon.spy();
      devices.unlink(cb);

      expect(cb.calledOnce).to.be.true;
      expect(keys.unset.calledWith('device')).to.be.true;
    });

    it('should handle 401 status and call the callback with INVALID_CREDENTIALS', () => {
      requestDeleteStub.callsFake((url, opts, cb) => cb(null, { statusCode: 401 }));
      keysStubGet.returns({ api: 'api-key', device: 'device-id' });

      const cb = sinon.spy();
      devices.unlink(cb);

      const expectedError = errors.get('INVALID_CREDENTIALS');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });

    it('should handle unknown status and call the callback with an unknown error', () => {
      keysStubGet.returns({ api: 'api-key', device: 'device-id' });
      requestDeleteStub.callsFake((url, opts, cb) => cb(null, { statusCode: 500 }));

      const cb = sinon.spy();
      devices.unlink(cb);

      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0]).to.be.an.instanceOf(Error);
      expect(cb.args[0][0].message).to.include('500');
    });
  });

  describe('post_location function', () => {
    it('should return an error if keys are missing', () => {
      keysStubGet.returns({ api: null, device: null });
      const cb = sinon.spy();
      devices.post_location({ location: true }, cb);
      const expectedError = errors.get('MISSING_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });

    it('should handle a successful 200 response', () => {
      request.post.callsFake((url, data, opts, cb) => cb(null, { statusCode: 200 }));
      keysStubGet.returns({ api: 'api-key', device: 'device-id' });
      const cb = sinon.spy();
      devices.post_location({ location: true }, cb);
      expect(cb.calledWith(null, true)).to.be.true;
    });
  });

  describe('post_sso_status function', () => {
    it('should return an error if data is missing', () => {
      const cb = sinon.spy();
      devices.post_sso_status(null, cb);

      const expectedError = errors.arguments('Empty data.');

      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });

    it('should call the callback on a successful 200 response', () => {
      request.post.callsFake((url, data, opts, cb) => cb(null, { statusCode: 200 }));
      const cb = sinon.spy();
      devices.post_sso_status({ status: true }, cb);
      expect(cb.calledWith(null)).to.be.true;
    });
  });

  describe('post_missing function', () => {
    it('should return an error if keys are missing', () => {
      keysStubGet.returns({ api: null, device: null });
      const cb = sinon.spy();
      devices.post_missing(true, cb);
      const expectedError = errors.get('MISSING_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });

    it('should return an error if the option is not a boolean', () => {
      const cb = sinon.spy();
      devices.post_missing('invalid-option', cb);
      expect(cb.calledWithMatch(sinon.match.instanceOf(Error))).to.be.true;
    });
  });

  describe('get.commands function', () => {
    it('should return an error if no device key is set', () => {
      keysStubGet.returns({ api: 'api-key' });
      const cb = sinon.spy();
      devices.get.commands(cb);
      const expectedError = errors.get('NO_DEVICE_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });
  });

  describe('get.status function', () => {
    it('should return an error if no device key is set', () => {
      keysStubGet.returns({ api: 'api-key' });
      const cb = sinon.spy();
      devices.get.status(cb);
      const expectedError = errors.get('NO_DEVICE_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });
  });

  describe('get.triggers function', () => {
    it('should return an error if no device key is set', () => {
      keysStubGet.returns({ api: 'api-key' });
      const cb = sinon.spy();
      devices.get.triggers(cb);
      const expectedError = errors.get('NO_DEVICE_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });
  });
});
