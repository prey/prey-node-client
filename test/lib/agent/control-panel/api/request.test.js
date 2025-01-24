const { expect } = require('chai');
const sinon = require('sinon');
const needle = require('needle');
const logger = require('../../../../../lib/agent/common').logger.prefix('api');
const request = require('../../../../../lib/agent/control-panel/api/request');

describe('request Module', () => {
  let needleRequestStub;
  let originalClient;
  let loggerErrorStub;

  beforeEach(() => {
    needleRequestStub = sinon.stub(needle, 'request');
    originalClient = request.defaults.client;
    console.log('Logger:', logger);
    console.log('Logger.error:', logger.error);
  });

  afterEach(() => {
    request.defaults.client = originalClient;
    loggerErrorStub = sinon.stub(logger, 'error');
    sinon.restore();
  });

  describe('send function', () => {
    it('should return an error if defaults.client is not set', () => {
      request.defaults.client = null;
      const cb = sinon.spy();
      const resultWithCallback = request.send(1, 'GET', '/mock-path', null, {}, cb);
      const expectedError = new Error('No HTTP client set!');
  
      expect(cb.calledOnce).to.be.true;
      expect(cb.args[0][0].message).to.equal(expectedError.message);
      expect(resultWithCallback).to.be.undefined; // Function does not return when cb is provided
      const resultWithoutCallback = request.send(1, 'GET', '/mock-path', null, {});
      expect(resultWithoutCallback).to.be.an.instanceOf(Error);
      expect(resultWithoutCallback.message).to.equal(expectedError.message);
    });

    it('should send a GET request with the correct parameters', () => {
      needleRequestStub.callsFake((method, url, data, opts, cb) => {
        cb(null, { statusCode: 200 }, 'response body');
      });

      const cb = sinon.spy();
      request.get('/mock-path', { timeout: 5000 }, cb);

      expect(needleRequestStub.calledOnceWith('GET')).to.be.true;
      const calledWithUrl = needleRequestStub.args[0][1];
      expect(calledWithUrl).to.include('/mock-path');
      expect(cb.calledOnceWith(null, { statusCode: 200 }, 'response body')).to.be.true;
    });

    it('should handle network down errors gracefully', () => {
      needleRequestStub.callsFake((method, url, data, opts, cb) => {
        cb({ code: 'ENETDOWN' }, null, null);
      });

      const cb = sinon.spy();
      request.get('/mock-path', {}, cb);

      expect(cb.calledOnce).to.be.true;
      const err = cb.args[0][0];
      expect(err.message).to.include('Network seems to be down');
    });

    it('should retry the request without proxy when network is down', () => {
        const cb = sinon.spy();
        const options = { proxy: 'http://mock-proxy.com', timeout: 5000 };
              needleRequestStub.callsFake((method, url, data, opts, callback) => {
          if (opts.proxy) {
            callback({ code: 'ENETDOWN' }, null, null);
          } else {
            callback(null, { statusCode: 200 }, 'success');
          }
        });
      
        request.send(1, 'GET', '/mock-path', null, options, cb);
      
        expect(cb.calledOnce).to.be.true;
        expect(cb.args[0][0]).to.be.null;
        expect(cb.args[0][1].statusCode).to.equal(200);
        expect(cb.args[0][2]).to.equal('success');
        expect(needleRequestStub.calledTwice).to.be.true;
    });   
      
  });

  describe('post function', () => {
    it('should send a POST request with the correct parameters', () => {
      needleRequestStub.callsFake((method, url, data, opts, cb) => {
        cb(null, { statusCode: 201 }, 'response body');
      });

      const cb = sinon.spy();
      request.post('/mock-path', { key: 'value' }, { timeout: 5000 }, cb);

      expect(needleRequestStub.calledOnceWith('POST')).to.be.true;
      const calledWithUrl = needleRequestStub.args[0][1];
      expect(calledWithUrl).to.include('/mock-path');
      const calledWithData = needleRequestStub.args[0][2];
      expect(calledWithData).to.deep.equal({ key: 'value' });
      expect(cb.calledOnceWith(null, { statusCode: 201 }, 'response body')).to.be.true;
    });

    it('should retry on temporary server errors (502, 503)', () => {
      needleRequestStub.callsFake((method, url, data, opts, cb) => {
        cb(null, { statusCode: 502 }, null);
      });

      const cb = sinon.spy();
      request.post('/mock-path', { key: 'value' }, {}, cb);

      expect(cb.calledOnce).to.be.false;
    });
  });

  describe('delete function', () => {
    it('should send a DELETE request with the correct parameters', () => {
      needleRequestStub.callsFake((method, url, data, opts, cb) => {
        cb(null, { statusCode: 200 }, 'response body');
      });

      const cb = sinon.spy();
      request.delete('/mock-path', {}, cb);

      expect(needleRequestStub.calledOnceWith('DELETE')).to.be.true;
      const calledWithUrl = needleRequestStub.args[0][1];
      expect(calledWithUrl).to.include('/mock-path');
      expect(cb.calledOnceWith(null, { statusCode: 200 }, 'response body')).to.be.true;
    });
  });

  describe('use function', () => {
    it('should update defaults with valid options', () => {
      const newDefaults = {
        protocol: 'https',
        host: 'new-host.com',
      };

      const updatedDefaults = request.use(newDefaults);
      expect(updatedDefaults.protocol).to.equal('https');
      expect(updatedDefaults.host).to.equal('new-host.com');
    });
  });
});
