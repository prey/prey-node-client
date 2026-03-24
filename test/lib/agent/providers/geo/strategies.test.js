/* eslint-disable no-unused-expressions */
/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
const sinon = require('sinon');
const { expect } = require('chai');
const rewire = require('rewire');

describe('Geo Strategies - PUT verified location behavior', () => {
  let strategies;
  let sendData;
  let needleStub;
  let storageStub;
  let keysStub;
  let loggerStub;
  let saveDataWifiStub;
  let configStub;

  const accessPoints = [
    {
      mac_address: 'AA:BB:CC:11:22:33',
      ssid: 'prey-test-1',
      signal_strength: -50,
      channel: 1,
    },
    {
      mac_address: 'AA:BB:CC:44:55:66',
      ssid: 'prey-test-2',
      signal_strength: -40,
      channel: 6,
    },
  ];

  const providerGeolocation = {
    location: {
      lat: -33.456,
      lng: -70.648,
      accuracy: 25,
    },
  };

  const endpointResponse = {
    endpoint: {
      url: 'https://example-geoloc-provider/loc',
      provider: 'external-provider',
      'user-agent': 'provider-agent/1.0',
    },
  };

  const stubStorageSuccessFlow = () => {
    storageStub.do.callsFake((operation, payload, cb) => {
      if (operation === 'query' && payload.id === 'last_wifi_location') {
        return cb(null, [{ value: '{}' }]);
      }
      if (operation === 'del' && payload.id === 'last_wifi_location') {
        return cb(null);
      }
      if (operation === 'set' && payload.id === 'last_wifi_location') {
        return cb(null);
      }
      return cb(null);
    });
  };

  beforeEach(() => {
    strategies = rewire('../../../../../lib/agent/providers/geo/strategies');

    needleStub = {
      post: sinon.stub(),
      put: sinon.stub(),
    };
    storageStub = { do: sinon.stub() };
    keysStub = { get: sinon.stub().returns({ device: 'device-id', api: 'api-key' }) };
    loggerStub = {
      debug: sinon.stub(),
      info: sinon.stub(),
      error: sinon.stub(),
    };
    saveDataWifiStub = sinon.stub();
    configStub = {
      getData: sinon.stub().callsFake((key) => {
        if (key === 'try_proxy') return null;
        if (key === 'control-panel.host') return 'panel.prey.example';
        return null;
      }),
    };

    strategies.__set__('needle', needleStub);
    strategies.__set__('storage', storageStub);
    strategies.__set__('keys', keysStub);
    strategies.__set__('logger', loggerStub);
    strategies.__set__('saveDataWifi', saveDataWifiStub);
    strategies.__set__('config', configStub);

    sendData = strategies.__get__('sendData');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should fallback to external provider location when PUT response has no location', (done) => {
    needleStub.post
      .onFirstCall()
      .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, endpointResponse))
      .onSecondCall()
      .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, providerGeolocation));

    needleStub.put.callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200, body: null }));

    stubStorageSuccessFlow();

    sendData(accessPoints, (err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal({
        lat: providerGeolocation.location.lat,
        lng: providerGeolocation.location.lng,
        accuracy: providerGeolocation.location.accuracy,
        method: 'wifi',
      });
      expect(needleStub.put.calledOnce).to.be.true;
      expect(loggerStub.info.calledWith('Using server-verified location instead of original')).to.be.false;
      done();
    });
  });

  it('should use corrected location when PUT response includes server-verified geolocation', (done) => {
    const correctedLocation = {
      location: {
        lat: -33.4,
        lng: -70.6,
        accuracy: 10,
      },
    };

    needleStub.post
      .onFirstCall()
      .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, endpointResponse))
      .onSecondCall()
      .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, providerGeolocation));

    needleStub.put.callsFake((_url, _data, _opts, cb) => {
      cb(null, { statusCode: 200, body: correctedLocation });
    });

    stubStorageSuccessFlow();

    sendData(accessPoints, (err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal({
        lat: correctedLocation.location.lat,
        lng: correctedLocation.location.lng,
        accuracy: correctedLocation.location.accuracy,
        method: 'wifi',
      });
      expect(needleStub.put.calledOnce).to.be.true;
      done();
    });
  });

  it('should log server-verified message when corrected location is used', (done) => {
    const correctedLocation = {
      location: {
        lat: 40.71,
        lng: -74,
        accuracy: 15,
      },
    };

    needleStub.post
      .onFirstCall()
      .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, endpointResponse))
      .onSecondCall()
      .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, providerGeolocation));

    needleStub.put.callsFake((_url, _data, _opts, cb) => {
      cb(null, { statusCode: 200, body: correctedLocation });
    });

    stubStorageSuccessFlow();

    sendData(accessPoints, (err) => {
      expect(err).to.be.null;
      expect(loggerStub.info.calledWith('Using server-verified location instead of original')).to.be.true;
      done();
    });
  });
});
