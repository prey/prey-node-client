/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

describe('Geo Win32 Native Geolocation', () => {
  let win32Geo;
  let systemStub;

  beforeEach(() => {
    win32Geo = rewire('../../../../../lib/agent/providers/geo/win32/index');
    systemStub = {
      get_as_admin_user: sinon.stub(),
    };
    win32Geo.__set__('system', systemStub);
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
        expect(err.message).to.equal('Unable to get location from admin service');
        done();
      });
    });

    it('should return error when output is missing lat', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lng: -122.4194, accuracy: 10.5 });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Unable to get location from admin service');
        done();
      });
    });

    it('should return error when output is missing lng', (done) => {
      systemStub.get_as_admin_user.callsFake((provider, cb) => {
        cb(null, { lat: 37.7749, accuracy: 10.5 });
      });

      win32Geo.get_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('Unable to get location from admin service');
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
});
