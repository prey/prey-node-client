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
    storageStub.do.callsFake((_operation, _payload, cb) => cb(null));
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
  let trustedRows;
  let capturedHistorySave;

  const makeStorageStub = () => {
    storageStub.do.callsFake((operation, payload, cb) => {
      const key = payload.data || payload.id;
      if (operation === 'query' && key === 'location_history_win32') return cb(null, historyRows);
      if (operation === 'query' && key === 'last_wifi_location') return cb(null, wifiRows);
      if (operation === 'query' && key === 'last_trusted_location') return cb(null, trustedRows);
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
    platformStub = {
      get_location: sinon.stub(),
      getLastPositionSource: sinon.stub().returns('unknown'),
    };
    wifiStub = sinon.stub();

    strategies.__set__('storage', storageStub);
    strategies.__set__('logger', loggerStub);
    strategies.__set__('config', configStub);
    strategies.__set__('platform', platformStub);
    strategies.__set__('wifi', wifiStub);
    strategies.__set__('saveDataWifi', sinon.stub());
    strategies.__set__('needle', {
      post: sinon.stub(),
      put: sinon.stub(),
      get: sinon.stub().callsFake((_url, cb) => cb(new Error('geoip unavailable'))),
    });
    strategies.__set__('keys', { get: sinon.stub().returns({ device: 'd', api: 'k' }) });

    historyRows = [];
    wifiRows = [];
    trustedRows = [];
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

  it('bootstrap: calls wifi for fresh data when anchor exists but history is empty', (done) => {
    trustedRows = [{ value: JSON.stringify(santiago) }];
    wifiStub.callsFake((cb) => cb(null, santiago));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      expect(platformStub.get_location.called).to.be.false;
      expect(wifiStub.calledOnce).to.be.true;
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

  it('normal: jump detected, wifi accuracy < native accuracy → wifi wins via selectBestLocation', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    // native 150m (passes ≤200m check), wifi 48m (better accuracy) → wifi wins
    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 150 }));
    wifiStub.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 48, method: 'wifi' }));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result.accuracy).to.equal(48);
      expect(result.method).to.equal('wifi');
      done();
    });
  });

  it('normal: native ok (≤100m), distance >50km, wifi fails → falls back to geoip', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 30 }));
    wifiStub.callsFake((cb) => cb(new Error('wifi timeout')));
    strategies.__set__('needle', {
      post: sinon.stub(),
      put: sinon.stub(),
      get: sinon.stub().callsFake((_url, cb) => cb(null, {}, { loc: `${santiago.lat},${santiago.lng}` })),
    });

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result.lat).to.be.closeTo(santiago.lat, 0.01);
      expect(result.lng).to.be.closeTo(santiago.lng, 0.01);
      expect(result.method).to.equal('geoip');
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

  it('saveToLocationHistory: drops oldest entry when history exceeds 15', (done) => {
    const entries = Array.from({ length: 15 }, (_, i) => ({ lat: i, lng: i, accuracy: 10 }));
    historyRows = [{ value: JSON.stringify(entries) }];
    const saveToLocationHistory = strategies.__get__('saveToLocationHistory');
    const newEntry = { lat: 99, lng: 99, accuracy: 5 };

    saveToLocationHistory(newEntry, (err) => {
      expect(err).to.be.null;
      expect(capturedHistorySave).to.have.lengthOf(15);
      expect(capturedHistorySave[capturedHistorySave.length - 1]).to.deep.equal(newEntry);
      expect(capturedHistorySave[0].lat).to.equal(1); // entry[0] was dropped
      done();
    });
  });
});

describe('Geo Strategies - Recovery Mechanism (Option 6)', () => {
  const santiago = { lat: -33.4569, lng: -70.6483, accuracy: 30, method: 'wifi' };
  const santiagoNear = { lat: -33.46, lng: -70.65, accuracy: 50, method: 'native' };
  const buenosAires = { lat: -34.6037, lng: -58.3816, accuracy: 30, method: 'native' };
  const londonCity = { lat: 51.5074, lng: -0.1278, accuracy: 25, method: 'native' };

  let strategies;
  let storageStub;
  let loggerStub;
  let platformStub;
  let wifiStub;
  let configStub;
  let historyRows;
  let wifiRows;
  let trustedRows;
  let capturedHistorySave;
  let capturedTrustedSave;

  const makeStorageStub = () => {
    storageStub.do.callsFake((operation, payload, cb) => {
      const key = payload.data || payload.id;
      if (operation === 'query' && key === 'location_history_win32') return cb(null, historyRows);
      if (operation === 'query' && key === 'last_wifi_location') return cb(null, wifiRows);
      if (operation === 'query' && key === 'last_trusted_location') return cb(null, trustedRows);
      if (operation === 'set' && payload.id === 'location_history_win32') {
        capturedHistorySave = JSON.parse(payload.data.value);
        return cb(null);
      }
      if (operation === 'update' && payload.id === 'location_history_win32') {
        capturedHistorySave = JSON.parse(payload.values);
        return cb(null);
      }
      if (operation === 'set' && payload.id === 'last_trusted_location') {
        capturedTrustedSave = JSON.parse(payload.data.value);
        return cb(null);
      }
      if (operation === 'update' && payload.id === 'last_trusted_location') {
        capturedTrustedSave = JSON.parse(payload.values);
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
    platformStub = {
      get_location: sinon.stub(),
      getLastPositionSource: sinon.stub().returns('unknown'),
    };
    wifiStub = sinon.stub();

    strategies.__set__('storage', storageStub);
    strategies.__set__('logger', loggerStub);
    strategies.__set__('config', configStub);
    strategies.__set__('platform', platformStub);
    strategies.__set__('wifi', wifiStub);
    strategies.__set__('saveDataWifi', sinon.stub());
    strategies.__set__('needle', {
      post: sinon.stub(),
      put: sinon.stub(),
      get: sinon.stub().callsFake((_url, cb) => cb(new Error('geoip unavailable'))),
    });
    strategies.__set__('keys', { get: sinon.stub().returns({ device: 'd', api: 'k' }) });

    historyRows = [];
    wifiRows = [];
    trustedRows = [];
    capturedHistorySave = null;
    capturedTrustedSave = null;
    makeStorageStub();

    // Reset module state before each test
    strategies.__set__('win32AnchorLocation', null);
    strategies.__set__('win32NativeOnlyCount', 0);
    strategies.__set__('win32LastFetchTime', null);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('bootstrap: calls wifi for fresh data even when anchor exists (history empty)', (done) => {
    trustedRows = [{ value: JSON.stringify(santiago) }];
    wifiStub.callsFake((cb) => cb(null, santiago));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      expect(wifiStub.calledOnce).to.be.true;
      expect(capturedHistorySave).to.be.an('array').with.lengthOf(1);
      expect(capturedHistorySave[0]).to.deep.equal(santiago);
      done();
    });
  });

  it('bootstrap: calls fresh WiFi when no trusted baseline, even if last_wifi_location exists', (done) => {
    wifiRows = [{ value: JSON.stringify(santiago) }];
    wifiStub.callsFake((cb) => cb(null, buenosAires));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(buenosAires);
      expect(wifiStub.calledOnce).to.be.true;
      expect(capturedTrustedSave).to.deep.equal(buenosAires);
      done();
    });
  });

  it('bootstrap: initializes trusted location from fresh wifi fetch', (done) => {
    wifiStub.callsFake((cb) => cb(null, santiago));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      expect(capturedTrustedSave).to.deep.equal(santiago);
      done();
    });
  });

  it('recovery: wifi fails during jump detection, falls back to geoip, trusted not corrupted', (done) => {
    // Setup: Santiago is trusted baseline
    strategies.__set__('win32AnchorLocation', santiago);
    historyRows = [{ value: JSON.stringify([santiago]) }];

    platformStub.get_location.callsFake((cb) => {
      // Native returns London (spurious, 5600km away)
      cb(null, { ...londonCity, accuracy: 95 });
    });

    wifiStub.callsFake((cb) => {
      // WiFi fails on jump detection
      cb(new Error('wifi timeout'));
    });

    // Geoip succeeds and returns Santiago
    strategies.__set__('needle', {
      post: sinon.stub(),
      put: sinon.stub(),
      get: sinon.stub().callsFake((_url, cb) => cb(null, {}, { loc: `${santiago.lat},${santiago.lng}` })),
    });

    // First fetch: Jump detected (5600km), WiFi fails → geoip fallback
    strategies.win32LocationFetch((err1, result1) => {
      expect(err1).to.be.null;
      expect(result1.method).to.equal('geoip');
      // Trusted must STAY Santiago (not corrupted by spurious London native)
      const trusted = strategies.__get__('win32AnchorLocation');
      expect(trusted).to.deep.equal(santiago);
      done();
    });
  });

  it('recovery: native-only counter increments and resets correctly', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);

    platformStub.get_location.callsFake((cb) => {
      // Native returns Santiago nearby (OK distance)
      cb(null, santiagoNear);
    });

    wifiStub.callsFake((cb) => cb(null, santiago));

    // Cycle 1
    strategies.win32LocationFetch((err1, result1) => {
      expect(err1).to.be.null;
      let counter = strategies.__get__('win32NativeOnlyCount');
      expect(counter).to.equal(1);

      strategies.__set__('win32LastFetchTime', Date.now() - 61000);

      // Cycle 2
      strategies.win32LocationFetch((err2, result2) => {
        expect(err2).to.be.null;
        counter = strategies.__get__('win32NativeOnlyCount');
        expect(counter).to.equal(2);

        strategies.__set__('win32LastFetchTime', Date.now() - 61000);

        // Cycle 3: Trigger periodic validation
        strategies.win32LocationFetch((err3, result3) => {
          expect(err3).to.be.null;
          // Counter resets after validation
          counter = strategies.__get__('win32NativeOnlyCount');
          expect(counter).to.equal(0);
          done();
        });
      });
    });
  });

  it('recovery: periodic validation every 3 cycles triggers wifi call', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);

    platformStub.get_location.callsFake((cb) => {
      cb(null, santiagoNear);
    });

    let wifiCallCount = 0;
    wifiStub.callsFake((cb) => {
      wifiCallCount++;
      cb(null, santiago);
    });

    // Cycle 1
    strategies.win32LocationFetch((err1) => {
      expect(err1).to.be.null;
      expect(wifiCallCount).to.equal(0);

      strategies.__set__('win32LastFetchTime', Date.now() - 61000);

      // Cycle 2
      strategies.win32LocationFetch((err2) => {
        expect(err2).to.be.null;
        expect(wifiCallCount).to.equal(0);

        strategies.__set__('win32LastFetchTime', Date.now() - 61000);

        // Cycle 3: Should trigger periodic WiFi validation
        strategies.win32LocationFetch((err3) => {
          expect(err3).to.be.null;
          expect(wifiCallCount).to.equal(1);
          done();
        });
      });
    });
  });

  it('recovery: periodic validation updates trusted location on success', (done) => {
    const initialTrusted = santiago;
    historyRows = [{ value: JSON.stringify([initialTrusted]) }];
    strategies.__set__('win32AnchorLocation', initialTrusted);
    strategies.__set__('win32NativeOnlyCount', 2); // Set to 2, next fetch will trigger validation

    const updatedTrusted = { lat: -33.5, lng: -70.6, accuracy: 20, method: 'wifi' };

    platformStub.get_location.callsFake((cb) => {
      cb(null, santiagoNear);
    });

    wifiStub.callsFake((cb) => {
      // Periodic validation triggers and returns updated location
      cb(null, updatedTrusted);
    });

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      // After periodic validation, trusted should be updated
      const trusted = strategies.__get__('win32AnchorLocation');
      expect(trusted).to.deep.equal(updatedTrusted);
      // Counter should be reset to 0 after validation
      const counter = strategies.__get__('win32NativeOnlyCount');
      expect(counter).to.equal(0);
      done();
    });
  });

  it('recovery: jump detection resets counter', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);
    strategies.__set__('win32NativeOnlyCount', 2);

    platformStub.get_location.callsFake((cb) => {
      // Return Buenos Aires (jump)
      cb(null, { ...buenosAires, accuracy: 95 });
    });

    wifiStub.callsFake((cb) => {
      cb(new Error('wifi fails'));
    });

    // Geoip succeeds (needed since wifi fails on jump and we fall back to geoip)
    strategies.__set__('needle', {
      post: sinon.stub(),
      put: sinon.stub(),
      get: sinon.stub().callsFake((_url, cb) => cb(null, {}, { loc: `${santiago.lat},${santiago.lng}` })),
    });

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      // Counter should be reset to 0 after jump detection
      const counter = strategies.__get__('win32NativeOnlyCount');
      expect(counter).to.equal(0);
      done();
    });
  });

  it('recovery: trusted location is used for jump detection comparison', (done) => {
    // Verify that trusted location is used as baseline, not lastValid
    const trustedLoc = { lat: -33.456, lng: -70.648, accuracy: 30, method: 'wifi' };
    const spuriousLoc = { lat: -34.6, lng: -58.38, accuracy: 50, method: 'native' }; // Buenos Aires
    // validNearby is ~0.1km from trustedLoc (within the 1km threshold) but ~900km from spuriousLoc
    const validNearby = { lat: -33.457, lng: -70.648, accuracy: 50, method: 'native' };

    historyRows = [{ value: JSON.stringify([spuriousLoc]) }]; // Last entry is bogus
    strategies.__set__('win32AnchorLocation', trustedLoc); // But trusted is correct

    platformStub.get_location.callsFake((cb) => {
      cb(null, validNearby); // ~0.1km from trusted, well within 1km threshold
    });

    wifiStub.callsFake((cb) => {
      cb(new Error('should not be called for nearby location'));
    });

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      // Should accept nearby because trusted is correct, not spurious history
      expect(result.lat).to.be.closeTo(validNearby.lat, 0.01);
      done();
    });
  });

  it('telemetry: location.native_accepted sent when native is within threshold', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);

    platformStub.get_location.callsFake((cb) => cb(null, { ...santiagoNear, accuracy: 45 }));
    platformStub.getLastPositionSource.returns('satellite');

    let capturedTelemetry = null;
    const needleStub2 = {
      post: sinon.stub().callsFake((_url, payload, _opts, cb) => {
        if (payload.event === 'location.native_accepted') capturedTelemetry = payload;
        if (cb) cb(null);
      }),
      put: sinon.stub(),
      get: sinon.stub().callsFake((_url, cb) => cb(new Error('geoip unavailable'))),
    };
    strategies.__set__('needle', needleStub2);

    strategies.win32LocationFetch((err) => {
      expect(err).to.be.null;
      expect(capturedTelemetry).to.not.be.null;
      expect(capturedTelemetry.event).to.equal('location.native_accepted');
      expect(capturedTelemetry.native_position_source).to.equal('satellite');
      expect(capturedTelemetry.native_accuracy_m).to.equal(45);
      expect(capturedTelemetry.anchor_distance_m).to.be.a('number');
      expect(capturedTelemetry.threshold_m).to.equal(1000);
      expect(capturedTelemetry.device_key).to.not.be.undefined;
      expect(capturedTelemetry.timestamp).to.be.a('string');
      done();
    });
  });

  it('telemetry: location.wifi_crosscheck sent with suspicious_distance + wifi_accepted', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);

    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 150 }));
    platformStub.getLastPositionSource.returns('cellular');
    const wifiResult = { ...buenosAires, accuracy: 48, method: 'wifi' };
    wifiStub.callsFake((cb) => cb(null, wifiResult));

    let capturedTelemetry = null;
    const needleStub2 = {
      post: sinon.stub().callsFake((_url, payload, _opts, cb) => {
        if (payload.event === 'location.wifi_crosscheck') capturedTelemetry = payload;
        if (cb) cb(null);
      }),
      put: sinon.stub(),
      get: sinon.stub(),
    };
    strategies.__set__('needle', needleStub2);

    strategies.win32LocationFetch((err) => {
      expect(err).to.be.null;
      expect(capturedTelemetry).to.not.be.null;
      expect(capturedTelemetry.event).to.equal('location.wifi_crosscheck');
      expect(capturedTelemetry.trigger).to.equal('suspicious_distance');
      expect(capturedTelemetry.outcome).to.equal('wifi_accepted');
      expect(capturedTelemetry.native_position_source).to.equal('cellular');
      expect(capturedTelemetry.native_accuracy_m).to.equal(150);
      expect(capturedTelemetry.wifi_accuracy_m).to.equal(48);
      expect(capturedTelemetry.native_wifi_delta_m).to.be.a('number');
      expect(capturedTelemetry.anchor_distance_m).to.be.above(1000);
      expect(capturedTelemetry.threshold_m).to.equal(1000);
      done();
    });
  });

  it('telemetry: location.wifi_crosscheck sent with suspicious_distance + unverified when wifi fails', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);

    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 150 }));
    platformStub.getLastPositionSource.returns('unknown');
    wifiStub.callsFake((cb) => cb(new Error('wifi timeout')));

    let capturedTelemetry = null;
    const needleStub2 = {
      post: sinon.stub().callsFake((_url, payload, _opts, cb) => {
        if (payload.event === 'location.wifi_crosscheck') capturedTelemetry = payload;
        if (cb) cb(null);
      }),
      put: sinon.stub(),
      get: sinon.stub().callsFake((_url, cb) => cb(null, {}, { loc: `${santiago.lat},${santiago.lng}` })),
    };
    strategies.__set__('needle', needleStub2);

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result.method).to.equal('geoip');
      expect(capturedTelemetry).to.not.be.null;
      expect(capturedTelemetry.event).to.equal('location.wifi_crosscheck');
      expect(capturedTelemetry.trigger).to.equal('suspicious_distance');
      expect(capturedTelemetry.outcome).to.equal('unverified');
      expect(capturedTelemetry.wifi_accuracy_m).to.be.null;
      expect(capturedTelemetry.native_wifi_delta_m).to.be.null;
      done();
    });
  });

  it('telemetry: location.wifi_crosscheck sent with calibration trigger on 3rd native cycle', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);
    strategies.__set__('win32NativeOnlyCount', 2);

    platformStub.get_location.callsFake((cb) => cb(null, { ...santiagoNear, accuracy: 55 }));
    platformStub.getLastPositionSource.returns('satellite');
    wifiStub.callsFake((cb) => cb(null, santiago));

    let capturedTelemetry = null;
    const needleStub2 = {
      post: sinon.stub().callsFake((_url, payload, _opts, cb) => {
        if (payload.event === 'location.wifi_crosscheck' && payload.trigger === 'calibration') {
          capturedTelemetry = payload;
        }
        if (cb) cb(null);
      }),
      put: sinon.stub(),
      get: sinon.stub(),
    };
    strategies.__set__('needle', needleStub2);

    strategies.win32LocationFetch((err) => {
      expect(err).to.be.null;
      expect(capturedTelemetry).to.not.be.null;
      expect(capturedTelemetry.event).to.equal('location.wifi_crosscheck');
      expect(capturedTelemetry.trigger).to.equal('calibration');
      expect(capturedTelemetry.outcome).to.equal('wifi_accepted');
      expect(capturedTelemetry.native_position_source).to.equal('satellite');
      expect(capturedTelemetry.wifi_accuracy_m).to.not.be.null;
      expect(capturedTelemetry.native_wifi_delta_m).to.be.a('number');
      expect(capturedTelemetry.threshold_m).to.equal(1000);
      done();
    });
  });

  it('telemetry: calibration wifi_crosscheck shows unverified when wifi fails', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);
    strategies.__set__('win32NativeOnlyCount', 2);

    platformStub.get_location.callsFake((cb) => cb(null, { ...santiagoNear, accuracy: 55 }));
    platformStub.getLastPositionSource.returns('unknown');
    wifiStub.callsFake((cb) => cb(new Error('wifi timeout')));

    let capturedTelemetry = null;
    const needleStub2 = {
      post: sinon.stub().callsFake((_url, payload, _opts, cb) => {
        if (payload.event === 'location.wifi_crosscheck' && payload.trigger === 'calibration') {
          capturedTelemetry = payload;
        }
        if (cb) cb(null);
      }),
      put: sinon.stub(),
      get: sinon.stub(),
    };
    strategies.__set__('needle', needleStub2);

    strategies.win32LocationFetch((err) => {
      expect(err).to.be.null;
      expect(capturedTelemetry).to.not.be.null;
      expect(capturedTelemetry.trigger).to.equal('calibration');
      expect(capturedTelemetry.outcome).to.equal('unverified');
      expect(capturedTelemetry.wifi_accuracy_m).to.be.null;
      expect(capturedTelemetry.native_wifi_delta_m).to.be.null;
      done();
    });
  });

  it('processResponse: returns data without writing to variables or storage', (done) => {
    const processResponse = strategies.__get__('processResponse');
    const coords = {
      location: { lat: -33.456, lng: -70.648, accuracy: 25 },
      accuracy: 25,
    };
    storageStub.do.reset();

    processResponse(coords, (err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal({
        lat: -33.456, lng: -70.648, accuracy: 25, method: 'wifi',
      });
      expect(storageStub.do.called).to.be.false;
      done();
    });
  });
});

describe('Geo Strategies - Anchor Eligibility & Quality Separation', () => {
  const santiago = { lat: -33.4569, lng: -70.6483, accuracy: 30, method: 'wifi' };
  const buenosAires = { lat: -34.6037, lng: -58.3816, accuracy: 30, method: 'native' };

  let strategies;
  let storageStub;
  let loggerStub;
  let platformStub;
  let wifiStub;
  let configStub;
  let historyRows;
  let trustedRows;
  let capturedHistorySave;
  let capturedTrustedSave;

  const makeStorageStub = () => {
    storageStub.do.callsFake((operation, payload, cb) => {
      const key = payload.data || payload.id;
      if (operation === 'query' && key === 'location_history_win32') return cb(null, historyRows);
      if (operation === 'query' && key === 'last_trusted_location') return cb(null, trustedRows);
      if (operation === 'set' && payload.id === 'location_history_win32') {
        capturedHistorySave = JSON.parse(payload.data.value);
        return cb(null);
      }
      if (operation === 'update' && payload.id === 'location_history_win32') {
        capturedHistorySave = JSON.parse(payload.values);
        return cb(null);
      }
      if (operation === 'set' && payload.id === 'last_trusted_location') {
        capturedTrustedSave = JSON.parse(payload.data.value);
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
    platformStub = {
      get_location: sinon.stub(),
      getLastPositionSource: sinon.stub().returns('unknown'),
    };
    wifiStub = sinon.stub();

    strategies.__set__('storage', storageStub);
    strategies.__set__('logger', loggerStub);
    strategies.__set__('config', configStub);
    strategies.__set__('platform', platformStub);
    strategies.__set__('wifi', wifiStub);
    strategies.__set__('saveDataWifi', sinon.stub());
    strategies.__set__('needle', {
      post: sinon.stub(),
      put: sinon.stub(),
      get: sinon.stub().callsFake((_url, cb) => cb(new Error('geoip unavailable'))),
    });
    strategies.__set__('keys', { get: sinon.stub().returns({ device: 'd', api: 'k' }) });

    historyRows = [];
    trustedRows = [];
    capturedHistorySave = null;
    capturedTrustedSave = null;
    makeStorageStub();

    strategies.__set__('win32AnchorLocation', null);
    strategies.__set__('win32NativeOnlyCount', 0);
    strategies.__set__('win32LastFetchTime', null);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('isAnchorEligible: true para accuracy = 300m (límite exacto)', () => {
    const isAnchorEligible = strategies.__get__('isAnchorEligible');
    expect(isAnchorEligible({ accuracy: 300 })).to.be.true;
  });

  it('isAnchorEligible: false para accuracy = 301m (sobre el límite)', () => {
    const isAnchorEligible = strategies.__get__('isAnchorEligible');
    expect(isAnchorEligible({ accuracy: 301 })).to.be.false;
  });

  it('isAnchorEligible: false cuando accuracy falta', () => {
    const isAnchorEligible = strategies.__get__('isAnchorEligible');
    expect(isAnchorEligible({ lat: 1, lng: 1 })).to.be.false;
  });

  it('isAnchorEligible: false cuando accuracy es NaN', () => {
    const isAnchorEligible = strategies.__get__('isAnchorEligible');
    expect(isAnchorEligible({ accuracy: NaN })).to.be.false;
  });

  it('isAnchorEligible: false cuando accuracy es Infinity', () => {
    const isAnchorEligible = strategies.__get__('isAnchorEligible');
    expect(isAnchorEligible({ accuracy: Infinity })).to.be.false;
  });

  it('selectBestLocation: WiFi accuracy < native accuracy, WiFi ≤ 300m → retorna WiFi', () => {
    const selectBestLocation = strategies.__get__('selectBestLocation');
    const native = { lat: 1, lng: 1, accuracy: 150 };
    const wifi = { lat: 2, lng: 2, accuracy: 48, method: 'wifi' };
    expect(selectBestLocation(native, wifi)).to.equal(wifi);
  });

  it('selectBestLocation: Native accuracy < WiFi accuracy, WiFi ≤ 300m → retorna native', () => {
    const selectBestLocation = strategies.__get__('selectBestLocation');
    const native = { lat: 1, lng: 1, accuracy: 30 };
    const wifi = { lat: 2, lng: 2, accuracy: 50, method: 'wifi' };
    expect(selectBestLocation(native, wifi)).to.equal(native);
  });

  it('selectBestLocation: WiFi accuracy > 300m, native válido → retorna native', () => {
    const selectBestLocation = strategies.__get__('selectBestLocation');
    const native = { lat: 1, lng: 1, accuracy: 150 };
    const wifi = { lat: 2, lng: 2, accuracy: 400, method: 'wifi' };
    expect(selectBestLocation(native, wifi)).to.equal(native);
  });

  it('selectBestLocation: WiFi accuracy > 300m, no native → retorna WiFi (único disponible)', () => {
    const selectBestLocation = strategies.__get__('selectBestLocation');
    const wifi = { lat: 2, lng: 2, accuracy: 400, method: 'wifi' };
    expect(selectBestLocation(null, wifi)).to.equal(wifi);
  });

  it('selectBestLocation: WiFi null → retorna native', () => {
    const selectBestLocation = strategies.__get__('selectBestLocation');
    const native = { lat: 1, lng: 1, accuracy: 50 };
    expect(selectBestLocation(native, null)).to.equal(native);
  });

  it('selectBestLocation: Native null → retorna WiFi', () => {
    const selectBestLocation = strategies.__get__('selectBestLocation');
    const wifi = { lat: 2, lng: 2, accuracy: 50, method: 'wifi' };
    expect(selectBestLocation(null, wifi)).to.equal(wifi);
  });

  it('selectBestLocation: Native position_source ipaddress, WiFi disponible → descarta native', () => {
    const selectBestLocation = strategies.__get__('selectBestLocation');
    const native = { lat: 1, lng: 1, accuracy: 10, position_source: 'ipaddress' };
    const wifi = { lat: 2, lng: 2, accuracy: 200, method: 'wifi' };
    expect(selectBestLocation(native, wifi)).to.equal(wifi);
  });

  it('selectBestLocation: Native position_source ipaddress, WiFi null → retorna native (único)', () => {
    const selectBestLocation = strategies.__get__('selectBestLocation');
    const native = { lat: 1, lng: 1, accuracy: 10, position_source: 'ipaddress' };
    expect(selectBestLocation(native, null)).to.equal(native);
  });

  it('bootstrap fresh: WiFi accuracy > 300m → en history, anchor sigue null', (done) => {
    const badWifi = { lat: -33.4569, lng: -70.6483, accuracy: 500, method: 'wifi' };
    wifiStub.callsFake((cb) => cb(null, badWifi));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(badWifi);
      expect(capturedHistorySave).to.be.an('array').with.lengthOf(1);
      const anchor = strategies.__get__('win32AnchorLocation');
      expect(anchor).to.be.null;
      expect(capturedTrustedSave).to.be.null;
      done();
    });
  });

  it('bootstrap fresh: WiFi accuracy ≤ 300m → en history y anchor actualizado', (done) => {
    wifiStub.callsFake((cb) => cb(null, santiago));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      const anchor = strategies.__get__('win32AnchorLocation');
      expect(anchor).to.deep.equal(santiago);
      expect(capturedTrustedSave).to.deep.equal(santiago);
      done();
    });
  });

  it('jump detection: WiFi gana selectBestLocation + accuracy ≤ 300m → anchor actualizado', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);
    // native 150m (passes ≤200m check), wifi 48m (mejor) → wifi gana
    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 150 }));
    wifiStub.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 48, method: 'wifi' }));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result.accuracy).to.equal(48);
      expect(result.method).to.equal('wifi');
      const anchor = strategies.__get__('win32AnchorLocation');
      expect(anchor.accuracy).to.equal(48);
      done();
    });
  });

  it('jump detection: Native gana selectBestLocation → anchor NO se toca', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);
    // native accuracy 30 (mejor), wifi accuracy 50 → native gana
    platformStub.get_location.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 30 }));
    wifiStub.callsFake((cb) => cb(null, { ...buenosAires, accuracy: 50, method: 'wifi' }));

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result.accuracy).to.equal(30);
      expect(result.method).to.equal('native');
      const anchor = strategies.__get__('win32AnchorLocation');
      expect(anchor).to.deep.equal(santiago); // anchor intacto
      done();
    });
  });

  it('periodic validation: WiFi accuracy > 300m → anchor NO se actualiza', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);
    strategies.__set__('win32NativeOnlyCount', 2);

    const santiagoNear = { lat: -33.46, lng: -70.65, accuracy: 50 };
    platformStub.get_location.callsFake((cb) => cb(null, santiagoNear));
    wifiStub.callsFake((cb) => cb(null, { ...santiago, accuracy: 400, method: 'wifi' }));

    strategies.win32LocationFetch((err) => {
      expect(err).to.be.null;
      const anchor = strategies.__get__('win32AnchorLocation');
      expect(anchor).to.deep.equal(santiago); // anchor intacto, WiFi 400m > 300m
      done();
    });
  });

  it('periodic validation: WiFi accuracy ≤ 300m → anchor actualizado', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32AnchorLocation', santiago);
    strategies.__set__('win32NativeOnlyCount', 2);

    const santiagoNear = { lat: -33.46, lng: -70.65, accuracy: 50 };
    const updatedWifi = { ...santiago, accuracy: 100, method: 'wifi' };
    platformStub.get_location.callsFake((cb) => cb(null, santiagoNear));
    wifiStub.callsFake((cb) => cb(null, updatedWifi));

    strategies.win32LocationFetch((err) => {
      expect(err).to.be.null;
      const anchor = strategies.__get__('win32AnchorLocation');
      expect(anchor).to.deep.equal(updatedWifi);
      done();
    });
  });
});
