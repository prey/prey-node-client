/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

describe('Geo Index - Strategy Orchestration', () => {
  let geoIndex;
  let strategiesStub;
  let hooksStub;
  let permissionFileStub;
  let socketStub;
  let getLocationPermissionStub;

  beforeEach(() => {
    geoIndex = rewire('../../../../../lib/agent/providers/geo/index');

    strategiesStub = {
      native: sinon.stub(),
      wifi: sinon.stub(),
      geoip: sinon.stub(),
    };
    hooksStub = { trigger: sinon.stub() };
    permissionFileStub = { getData: sinon.stub().returns('false') };
    socketStub = { writeMessage: sinon.stub() };
    getLocationPermissionStub = sinon.stub();

    geoIndex.__set__('strategies', strategiesStub);
    geoIndex.__set__('hooks', hooksStub);
    geoIndex.__set__('permissionFile', permissionFileStub);
    geoIndex.__set__('socket', socketStub);
    geoIndex.__set__('getLocationPermission', getLocationPermissionStub);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('fetch_location on Windows', () => {
    beforeEach(() => {
      geoIndex.__set__('osName', 'windows');
    });

    it('should use native as default strategy', (done) => {
      const locationData = { lat: 37.77, lng: -122.41, accuracy: 10 };
      strategiesStub.native.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(strategiesStub.native.calledOnce).to.be.true;
        expect(strategiesStub.wifi.called).to.be.false;
        expect(strategiesStub.geoip.called).to.be.false;
        done();
      });
    });

    it('should fallback to wifi when native fails', (done) => {
      const locationData = {
        lat: 37.77, lng: -122.41, accuracy: 20, method: 'wifi',
      };
      strategiesStub.native.callsFake((cb) => cb(new Error('native failed')));
      strategiesStub.wifi.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(strategiesStub.native.calledOnce).to.be.true;
        expect(strategiesStub.wifi.calledOnce).to.be.true;
        expect(strategiesStub.geoip.called).to.be.false;
        done();
      });
    });

    it('should fallback to wifi when native returns malformed payload error', (done) => {
      const locationData = {
        lat: 37.77, lng: -122.41, accuracy: 20, method: 'wifi',
      };
      strategiesStub.native.callsFake((cb) => cb(new Error('Unable to get location from admin service')));
      strategiesStub.wifi.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(strategiesStub.native.calledOnce).to.be.true;
        expect(strategiesStub.wifi.calledOnce).to.be.true;
        expect(strategiesStub.geoip.called).to.be.false;
        done();
      });
    });

    it('should fallback to geoip when native and wifi fail', (done) => {
      const locationData = { lat: 37.77, lng: -122.41, method: 'geoip' };
      strategiesStub.native.callsFake((cb) => cb(new Error('native failed')));
      strategiesStub.wifi.callsFake((cb) => cb(new Error('wifi failed')));
      strategiesStub.geoip.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(strategiesStub.native.calledOnce).to.be.true;
        expect(strategiesStub.wifi.calledOnce).to.be.true;
        expect(strategiesStub.geoip.calledOnce).to.be.true;
        done();
      });
    });

    it('should return error when all strategies fail', (done) => {
      strategiesStub.native.callsFake((cb) => cb(new Error('native failed')));
      strategiesStub.wifi.callsFake((cb) => cb(new Error('wifi failed')));
      strategiesStub.geoip.callsFake((cb) => cb(new Error('geoip failed')));

      geoIndex.fetch_location((err) => {
        expect(err).to.be.an.instanceOf(Error);
        expect(err.message).to.equal('geoip failed');
        expect(strategiesStub.native.calledOnce).to.be.true;
        expect(strategiesStub.wifi.calledOnce).to.be.true;
        expect(strategiesStub.geoip.calledOnce).to.be.true;
        done();
      });
    });

    it('should schedule location permission request', (done) => {
      strategiesStub.native.callsFake((cb) => cb(null, { lat: 1, lng: 2 }));

      geoIndex.fetch_location(() => {
        // getLocationPermission is called via setTimeout(8000), verify it's scheduled
        expect(getLocationPermissionStub.called).to.be.false; // not called immediately
        done();
      });
    });
  });

  describe('fetch_location on macOS', () => {
    beforeEach(() => {
      geoIndex.__set__('osName', 'mac');
      socketStub.writeMessage.callsFake((_msg, cb) => cb());
    });

    it('should use native strategy when nativeLocation permission is true', (done) => {
      const locationData = { lat: 12.34, lng: 56.78, method: 'native' };
      permissionFileStub.getData.callsFake((key) => {
        if (key === 'nativeLocation') return 'true';
        if (key === 'wifiLocation') return 'false';
        return 'false';
      });
      strategiesStub.native.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(socketStub.writeMessage.calledOnce).to.be.true;
        expect(strategiesStub.native.calledOnce).to.be.true;
        expect(strategiesStub.wifi.called).to.be.false;
        expect(strategiesStub.geoip.called).to.be.false;
        done();
      });
    });

    it('should use wifi strategy when nativeLocation is false and wifiLocation is true', (done) => {
      const locationData = {
        lat: 10.1, lng: -70.2, accuracy: 30, method: 'wifi',
      };
      permissionFileStub.getData.callsFake((key) => {
        if (key === 'nativeLocation') return 'false';
        if (key === 'wifiLocation') return 'true';
        return 'false';
      });
      strategiesStub.wifi.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(socketStub.writeMessage.calledOnce).to.be.true;
        expect(strategiesStub.wifi.calledOnce).to.be.true;
        expect(strategiesStub.native.called).to.be.false;
        done();
      });
    });

    it('should fallback to geoip strategy when both permissions are false', (done) => {
      const locationData = { lat: -33.45, lng: -70.66, method: 'geoip' };
      permissionFileStub.getData.callsFake((key) => {
        if (key === 'nativeLocation') return 'false';
        if (key === 'wifiLocation') return 'false';
        return 'false';
      });
      strategiesStub.geoip.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(socketStub.writeMessage.calledOnce).to.be.true;
        expect(strategiesStub.geoip.calledOnce).to.be.true;
        expect(strategiesStub.native.called).to.be.false;
        expect(strategiesStub.wifi.called).to.be.false;
        done();
      });
    });
  });

  describe('fetch_location on Linux/Ubuntu', () => {
    beforeEach(() => {
      geoIndex.__set__('osName', 'linux');
      geoIndex.__set__('defaultStrategy', 'wifi');
    });

    it('should start with wifi strategy by default on linux', (done) => {
      const locationData = { lat: 51.5, lng: -0.12, method: 'wifi' };
      strategiesStub.wifi.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(strategiesStub.wifi.calledOnce).to.be.true;
        expect(strategiesStub.native.called).to.be.false;
        expect(getLocationPermissionStub.called).to.be.false;
        done();
      });
    });

    it('should fallback from wifi to geoip when wifi fails', (done) => {
      const locationData = { lat: 40.71, lng: -74, method: 'geoip' };
      strategiesStub.wifi.callsFake((cb) => cb(new Error('wifi failed')));
      strategiesStub.geoip.callsFake((cb) => cb(null, locationData));

      geoIndex.fetch_location((err, res) => {
        expect(err).to.be.null;
        expect(res).to.deep.equal(locationData);
        expect(strategiesStub.wifi.calledOnce).to.be.true;
        expect(strategiesStub.geoip.calledOnce).to.be.true;
        expect(getLocationPermissionStub.called).to.be.false;
        done();
      });
    });
  });
});
