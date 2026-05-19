/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

describe('Geo Win32 Native Geolocation', () => {
  let win32Geo;
  let systemStub;
  let needleStub;
  let loggerStub;

  beforeEach(() => {
    win32Geo = rewire('../../../../../lib/agent/providers/geo/win32/index');
    systemStub = {
      get_as_admin_user: sinon.stub(),
    };
    needleStub = {
      put: sinon.stub().callsFake((url, data, opts, cb) => cb(null)),
    };
    loggerStub = {
      info: sinon.stub(),
      debug: sinon.stub(),
    };
    win32Geo.__set__('system', systemStub);
    win32Geo.__set__('needle', needleStub);
    win32Geo.__set__('logger', loggerStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('get_location', () => {
    it('should return location data on successful response', (done) => {
      const locationData = {
        lat: 37.7749,
        lng: -122.4194,
        accuracy: 10.5,
        method: 'native',
      };

      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, locationData);
      });

      win32Geo.get_location((err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal(locationData);
        expect(systemStub.get_as_admin_user.calledOnce).to.be.true;
        expect(systemStub.get_as_admin_user.calledWith('geoloc')).to.be.true;
        done();
      });
    });

    it('should return location data when position_source is missing', (done) => {
      const locationData = {
        lat: 37.7749,
        lng: -122.4194,
        accuracy: 10.5,
        method: 'native',
      };

      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, locationData);
      });

      win32Geo.get_location((err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal(locationData);
        done();
      });
    });

    it('should return error when admin service returns error', (done) => {
      const serviceError = new Error('Admin service not available');

      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(serviceError);
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Admin service not available');
        done();
      });
    });

    it('should return error when output is null', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, null);
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Invalid coordinates from admin service');
        done();
      });
    });

    it('should return error when output is missing lat', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lng: -122.4194, accuracy: 10.5 });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Invalid coordinates from admin service');
        done();
      });
    });

    it('should return error when output is missing lng', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lat: 37.7749, accuracy: 10.5 });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Invalid coordinates from admin service');
        done();
      });
    });

    it('should return error when output is not an object', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, 'invalid');
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Invalid coordinates from admin service');
        done();
      });
    });

    it('should return error when output position_source is ipaddress', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, {
          lat: 37.7749,
          lng: -122.4194,
          position_source: ' ipaddress ',
        });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Got ipaddress native or non-WINRT source, which is not accurate');
        done();
      });
    });

    it('should return error when lat is NaN', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lat: Number.NaN, lng: -122.4194, accuracy: 10.5 });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Invalid coordinates from admin service');
        done();
      });
    });

    it('should return error when lng is not finite', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lat: 37.7749, lng: Infinity, accuracy: 10.5 });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Invalid coordinates from admin service');
        done();
      });
    });

    it('should return error when lat and lng are strings', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lat: '37.7749', lng: '-122.4194', accuracy: 10.5 });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Invalid coordinates from admin service');
        done();
      });
    });

    it('should return result (no error) when accuracy is greater than 100', (done) => {
      const locationData = {
        lat: 37.7749,
        lng: -122.4194,
        accuracy: 200,
        method: 'native',
      };

      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, locationData);
      });

      win32Geo.get_location((err, result) => {
        expect(err).to.be.null;
        expect(result.accuracy).to.equal(200);
        expect(result.lat).to.equal(37.7749);
        expect(result.lng).to.equal(-122.4194);
        done();
      });
    });

    it('should accept location when accuracy is exactly 100', (done) => {
      const locationData = {
        lat: 37.7749,
        lng: -122.4194,
        accuracy: 100,
        method: 'native',
      };

      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, locationData);
      });

      win32Geo.get_location((err, result) => {
        expect(err).to.be.null;
        expect(result).to.deep.equal(locationData);
        done();
      });
    });

    it('should call get_as_admin_user with geoloc provider', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lat: 1, lng: 2, accuracy: 5 });
      });

      win32Geo.get_location(() => {
        expect(systemStub.get_as_admin_user.firstCall.args[0]).to.equal('geoloc');
        done();
      });
    });

    it('should preserve error code when admin service returns error with code', (done) => {
      const serviceError = new Error('Service unavailable');
      serviceError.code = 'ECONNREFUSED';

      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(serviceError);
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Service unavailable');
        expect(err.code).to.equal('ECONNREFUSED');
        done();
      });
    });

    it('should preserve error stack when admin service returns error', (done) => {
      const serviceError = new Error('Network timeout');
      const originalStack = serviceError.stack;

      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(serviceError);
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Network timeout');
        expect(err.stack).to.equal(originalStack);
        done();
      });
    });

    it('should handle error with custom properties from admin service', (done) => {
      const serviceError = new Error('Custom error');
      serviceError.statusCode = 503;
      serviceError.details = { retry: true };

      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(serviceError);
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Custom error');
        expect(err.statusCode).to.equal(503);
        expect(err.details).to.deep.equal({ retry: true });
        done();
      });
    });
  });

  describe('askLocationNativePermission', () => {
    it('should call callback without error', (done) => {
      win32Geo.askLocationNativePermission((err) => {
        expect(err).to.be.undefined;
        done();
      });
    });

    it('should not throw when callback is not provided', () => {
      expect(() => win32Geo.askLocationNativePermission()).to.not.throw();
    });
  });

  describe('getLastPositionSource', () => {
    it('should return the position_source from the last successful get_location call', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, {
          lat: 37.7749,
          lng: -122.4194,
          accuracy: 10,
          position_source: 'satellite',
        });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.null;
        expect(win32Geo.getLastPositionSource()).to.equal('satellite');
        done();
      });
    });

    it('should return "unknown" when position_source is absent', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lat: 37.7749, lng: -122.4194, accuracy: 10 });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.null;
        expect(win32Geo.getLastPositionSource()).to.equal('unknown');
        done();
      });
    });
  });
});
