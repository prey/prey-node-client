const { expect } = require('chai');
const sinon = require('sinon');
const keys = require('../../../../../lib/agent/control-panel/api/keys');
const errors = require('../../../../../lib/agent/control-panel/api/errors');
const request = require('../../../../../lib/agent/control-panel/api/request');
const devices = require('../../../../../lib/agent/control-panel/api/devices');

describe('Devices Tests', () => {
  let requestStub;
  let keysSetStub;
  let keysGetStub;

  beforeEach(() => {
    requestStub = sinon.stub(request, 'post');
    keysSetStub = sinon.stub(keys, 'set');
    keysGetStub = sinon.stub(keys, 'get');
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('set function', () => {
    it('should set the device key correctly', () => {
      keysSetStub.returns({ api: 'api-key', device: 'new-device-key' });
  
      const result = devices.set('new-device-key');
      expect(result).to.equal('new-device-key');
      expect(keysSetStub.calledOnceWith({ device: 'new-device-key' })).to.be.true;
    });

    it('should throw an error if no key is provided', () => {
      expect(() => devices.set(null)).to.throw('No key!');
    });
  });

  describe('link function', () => {
    it('should return an error if data is missing', () => {
      const cb = sinon.spy();
      devices.link({}, cb);
      const expectedError = errors.arguments('Empty data.');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
    });
    
    it('should return an error if the device key is already set', () => {
      const cb = sinon.spy();
      keysGetStub.returns({ api: 'api-key', device: 'device-id' });
      devices.link({ someData: true }, cb);
      const expectedError = errors.get('DEVICE_KEY_SET');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });

    it('should return NO_API_KEY error if API key is not set', () => {
      const cb = sinon.spy();
      keysGetStub.returns({ api: null, device: null });
      devices.link({ someData: true }, cb);
      const expectedError = errors.get('NO_API_KEY');
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(cb.args[0][0].code).to.equal(expectedError.code);
    });  
    
    /* it('should handle a successful response with a new device key', () => {
      const cb = sinon.spy();
      requestStub.callsFake((url, data, opts, callback) => {
        callback(null, { body: { key: 'new-key' } });
      });

      devices.link({ someData: true }, cb);
      expect(cb.calledWith(null, 'new-key')).to.be.true;
    });

    it('should handle response code 401 as INVALID_CREDENTIALS', () => {
      const cb = sinon.spy();
      requestStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 401 });
      });

      devices.link({ someData: true }, cb);
      expect(cb.calledWith(errors.get('INVALID_CREDENTIALS'))).to.be.true;
    }); */
  });

/*   describe('unlink function', () => {
    it('should return an error if keys are missing', () => {
      keysGetStub.returns({});
      const cb = sinon.spy();
      devices.unlink(cb);
      expect(cb.calledWith(errors.get('MISSING_KEY'))).to.be.true;
    });

    it('should successfully unset the device key on 200 response', () => {
      requestStub.callsFake((url, opts, callback) => {
        callback(null, { statusCode: 200 });
      });

      const cb = sinon.spy();
      devices.unlink(cb);
      expect(cb.calledWith()).to.be.true;
    });
  }); */

 /*  describe('post_location function', () => {
    it('should return an error if keys are missing', () => {
      keysGetStub.returns({});
      const cb = sinon.spy();
      devices.post_location({ location: true }, cb);
      expect(cb.calledWith(errors.get('MISSING_KEY'))).to.be.true;
    });

    it('should return state true for 200 response', () => {
      requestStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 200 });
      });

      const cb = sinon.spy();
      devices.post_location({ location: true }, cb);
      expect(cb.calledWith(null, true)).to.be.true;
    });
  }); */

  describe('post_sso_status function', () => {
    /* it('should return an error if data is missing', () => {
      const cb = sinon.spy();
      devices.post_sso_status(null, cb);
      expect(cb.calledWith(errors.arguments('Empty data.'))).to.be.true;
    }); */

    it('should call the callback on a 200 response', () => {
      requestStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 200 });
      });

      const cb = sinon.spy();
      devices.post_sso_status({ status: true }, cb);
      expect(cb.calledWith(null)).to.be.true;
    });
  });

  /*describe('post_missing function', () => {
    it('should return an error if invalid option is passed', () => {
      const cb = sinon.spy();
      devices.post_missing('invalid', cb);
      expect(cb.calledWithMatch(sinon.match.instanceOf(Error))).to.be.true;
    });

     it('should return SAME_MISSING_STATE for a 201 response', () => {
      requestStub.callsFake((url, data, opts, callback) => {
        callback(null, { statusCode: 201 });
      });

      const cb = sinon.spy();
      devices.post_missing(true, cb);
      expect(cb.calledWith(errors.get('SAME_MISSING_STATE'))).to.be.true;
    }); 
  });

   describe('get.commands function', () => {
    it('should return an error if no device key is set', () => {
      keys.get.returns({});
      const cb = sinon.spy();
      devices.get.commands(cb);
      expect(cb.calledWith(errors.get('NO_DEVICE_KEY'))).to.be.true;
    });
  }); */
});
