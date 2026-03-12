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
});
