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
      if (operation === 'set' && payload.id === 'last_wifi_location') {
        return cb(null);
      }
      if (operation === 'update' && payload.id === 'last_wifi_location') {
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

  it('processResponse should not call del on last_wifi_location', (done) => {
    needleStub.post
      .onFirstCall()
      .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, endpointResponse))
      .onSecondCall()
      .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, providerGeolocation));
    needleStub.put.callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200, body: null }));
    stubStorageSuccessFlow();

    sendData(accessPoints, () => {
      const delCalled = storageStub.do.getCalls().some(
        (call) => call.args[0] === 'del' && call.args[1] && call.args[1].id === 'last_wifi_location',
      );
      expect(delCalled).to.be.false;
      done();
    });
  });
});

describe('Geo Strategies - win32LocationFetch', () => {
  // Santiago ~1100km from Buenos Aires, both well-known coords for distance assertions
  const santiago = { lat: -33.4569, lng: -70.6483, accuracy: 30, method: 'wifi' };
  const santiagoNear = { lat: -33.46, lng: -70.65, accuracy: 50, method: 'native' };
  const buenosAires = { lat: -34.6037, lng: -58.3816, accuracy: 30, method: 'native' };

  let strategies;
  let storageStub;
  let loggerStub;
  let platformStub;
  let wifiStub;
  let configStub;
  let historyRows;
  let wifiRows;
  let capturedHistorySave;

  const makeStorageStub = () => {
    storageStub.do.callsFake((operation, payload, cb) => {
      const key = payload.data || payload.id;
      if (operation === 'query' && key === 'location_history_win32') return cb(null, historyRows);
      if (operation === 'query' && key === 'last_wifi_location') return cb(null, wifiRows);
      if (operation === 'set' && payload.id === 'location_history_win32') {
        capturedHistorySave = JSON.parse(payload.data.value);
        return cb(null);
      }
      if (operation === 'update' && payload.id === 'location_history_win32') {
        capturedHistorySave = JSON.parse(payload.values);
        return cb(null);
      }
      return cb(null);
    });
  };

  beforeEach(() => {
    strategies = rewire('../../../../../lib/agent/providers/geo/strategies');

    storageStub = { do: sinon.stub() };
    loggerStub = { debug: sinon.stub(), info: sinon.stub(), error: sinon.stub() };
    configStub = {
      getData: sinon.stub().callsFake((key) => {
        if (key === 'control-panel.host') return 'panel.prey.example';
        return null;
      }),
    };
    platformStub = { get_location: sinon.stub() };
    wifiStub = sinon.stub();

    strategies.__set__('storage', storageStub);
    strategies.__set__('logger', loggerStub);
    strategies.__set__('config', configStub);
    strategies.__set__('platform', platformStub);
    strategies.__set__('wifi', wifiStub);
    strategies.__set__('saveDataWifi', sinon.stub());
    strategies.__set__('needle', { post: sinon.stub(), put: sinon.stub() });
    strategies.__set__('keys', { get: sinon.stub().returns({ device: 'd', api: 'k' }) });

    historyRows = [];
    wifiRows = [];
    capturedHistorySave = null;
    makeStorageStub();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('cache hit: returns last history entry without calling native or wifi', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32LastFetchTime', Date.now());

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      expect(platformStub.get_location.called).to.be.false;
      expect(wifiStub.called).to.be.false;
      done();
    });
  });

  it('bootstrap: seeds history from existing last_wifi_location', (done) => {
    wifiRows = [{ value: JSON.stringify(santiago) }];

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      expect(platformStub.get_location.called).to.be.false;
      expect(capturedHistorySave).to.be.an('array').with.lengthOf(1);
      expect(capturedHistorySave[0]).to.deep.equal(santiago);
      done();
    });
  });

  it('bootstrap: calls wifi when no last_wifi_location exists', (done) => {
    wifiStub.callsFake((cb) => cb(null, santiago));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      expect(wifiStub.calledOnce).to.be.true;
      expect(capturedHistorySave).to.be.an('array').with.lengthOf(1);
      done();
    });
  });

  it('bootstrap: propagates wifi error when no last_wifi_location and wifi fails', (done) => {
    wifiStub.callsFake((cb) => cb(new Error('wifi unavailable')));

    strategies.win32LocationFetch((err) => {
      expect(err).to.be.an.instanceOf(Error);
      expect(err.message).to.equal('wifi unavailable');
      done();
    });
  });

  it('normal: native ok (≤100m), distance ≤50km → saves and returns native', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    platformStub.get_location.callsFake((cb) => cb(null, santiagoNear));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal({ ...santiagoNear, method: 'native' });
      expect(capturedHistorySave).to.be.an('array').with.lengthOf(2);
      done();
    });
  });

  it('normal: native ok (≤100m), distance >50km, wifi confirms jump → saves best accuracy', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    // native has accuracy 30, wifi has accuracy 50 → native wins (lower = better)
    const wifiBA = { ...buenosAires, accuracy: 50, method: 'wifi' };
    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 30 }));
    wifiStub.callsFake((cb) => cb(null, wifiBA));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result.accuracy).to.equal(30);
      expect(result.method).to.equal('native');
      done();
    });
  });

  it('normal: native ok (≤100m), distance >50km, wifi denies jump → saves wifi result', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    // native says Buenos Aires but wifi confirms Santiago → no real jump
    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 30 }));
    wifiStub.callsFake((cb) => cb(null, { ...santiagoNear, method: 'wifi' }));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result.lat).to.be.closeTo(santiagoNear.lat, 0.01);
      expect(result.lng).to.be.closeTo(santiagoNear.lng, 0.01);
      done();
    });
  });

  it('normal: native ok (≤100m), distance >50km, wifi fails → saves native candidate', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 30 }));
    wifiStub.callsFake((cb) => cb(new Error('wifi timeout')));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result.lat).to.be.closeTo(buenosAires.lat, 0.01);
      expect(result.lng).to.be.closeTo(buenosAires.lng, 0.01);
      done();
    });
  });

  it('normal: native fails both attempts → wifi fallback succeeds', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    platformStub.get_location.callsFake((cb) => cb(null, { lat: buenosAires.lat, lng: buenosAires.lng, accuracy: 500 }));
    wifiStub.callsFake((cb) => cb(null, santiago));

    const mockTimeout = (_fn, _delay) => { _fn(); };

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      done();
    }, mockTimeout);
  });

  it('normal: native fails both attempts → wifi fallback also fails → error propagated', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    platformStub.get_location.callsFake((cb) => cb(new Error('native unavailable')));
    wifiStub.callsFake((cb) => cb(new Error('wifi unavailable')));

    const mockTimeout = (_fn, _delay) => { _fn(); };

    strategies.win32LocationFetch((err) => {
      expect(err).to.be.an.instanceOf(Error);
      expect(err.message).to.equal('wifi unavailable');
      done();
    }, mockTimeout);
  });

  it('concurrency guard: second call is queued and receives same result', (done) => {
    let pendingWifi;
    wifiStub.callsFake((cb) => { pendingWifi = cb; });

    let results = [];
    const collect = (err, res) => {
      results.push({ err, res });
      if (results.length === 2) {
        expect(results[0].err).to.be.null;
        expect(results[1].err).to.be.null;
        expect(results[0].res).to.deep.equal(santiago);
        expect(results[1].res).to.deep.equal(santiago);
        done();
      }
    };

    strategies.win32LocationFetch(collect);
    strategies.win32LocationFetch(collect);

    // both calls queued; now complete the wifi fetch
    pendingWifi(null, santiago);
  });

  it('saveToLocationHistory: drops oldest entry when history exceeds 20', (done) => {
    const entries = Array.from({ length: 20 }, (_, i) => ({ lat: i, lng: i, accuracy: 10 }));
    historyRows = [{ value: JSON.stringify(entries) }];
    const saveToLocationHistory = strategies.__get__('saveToLocationHistory');
    const newEntry = { lat: 99, lng: 99, accuracy: 5 };

    saveToLocationHistory(newEntry, (err) => {
      expect(err).to.be.null;
      expect(capturedHistorySave).to.have.lengthOf(20);
      expect(capturedHistorySave[capturedHistorySave.length - 1]).to.deep.equal(newEntry);
      expect(capturedHistorySave[0].lat).to.equal(1); // entry[0] was dropped
      done();
    });
  });
});
