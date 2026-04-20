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
    trustedRows = [];
    capturedHistorySave = null;
    capturedTrustedSave = null;
    makeStorageStub();

    // Reset module state before each test
    strategies.__set__('win32LastTrustedLocation', null);
    strategies.__set__('win32NativeOnlyCount', 0);
    strategies.__set__('win32LastFetchTime', null);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('bootstrap: initializes trusted location from existing last_wifi_location', (done) => {
    wifiRows = [{ value: JSON.stringify(santiago) }];

    strategies.win32LocationFetch((err, result) => {
      expect(err).to.be.null;
      expect(result).to.deep.equal(santiago);
      // Verify trusted was set (indirectly, by checking it persists to storage)
      expect(capturedTrustedSave).to.deep.equal(santiago);
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

  it('recovery: wifi fails during jump detection, trusted not corrupted by spurious native', (done) => {
    // Setup: Santiago is trusted baseline
    strategies.__set__('win32LastTrustedLocation', santiago);
    historyRows = [{ value: JSON.stringify([santiago]) }];

    platformStub.get_location.callsFake((cb) => {
      // Native returns London (spurious, 5600km away)
      cb(null, { ...londonCity, accuracy: 95 });
    });

    wifiStub.callsFake((cb) => {
      // WiFi fails on jump detection
      cb(new Error('wifi timeout'));
    });

    // First fetch: Jump detected (5600km), WiFi fails
    strategies.win32LocationFetch((err1, result1) => {
      expect(err1).to.be.null;
      // This cycle must accept the native since WiFi failed
      // And trusted should STAY Santiago (not corrupted by London)
      const trusted = strategies.__get__('win32LastTrustedLocation');
      expect(trusted).to.deep.equal(santiago);
      done();
    });
  });

  it('recovery: native-only counter increments and resets correctly', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32LastTrustedLocation', santiago);

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
    strategies.__set__('win32LastTrustedLocation', santiago);

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
    strategies.__set__('win32LastTrustedLocation', initialTrusted);
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
      const trusted = strategies.__get__('win32LastTrustedLocation');
      expect(trusted).to.deep.equal(updatedTrusted);
      // Counter should be reset to 0 after validation
      const counter = strategies.__get__('win32NativeOnlyCount');
      expect(counter).to.equal(0);
      done();
    });
  });

  it('recovery: jump detection resets counter', (done) => {
    historyRows = [{ value: JSON.stringify([santiago]) }];
    strategies.__set__('win32LastTrustedLocation', santiago);
    strategies.__set__('win32NativeOnlyCount', 2);

    platformStub.get_location.callsFake((cb) => {
      // Return Buenos Aires (jump)
      cb(null, { ...buenosAires, accuracy: 95 });
    });

    wifiStub.callsFake((cb) => {
      cb(new Error('wifi fails'));
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
    const validNearby = { lat: -33.5, lng: -70.65, accuracy: 50, method: 'native' };

    historyRows = [{ value: JSON.stringify([spuriousLoc]) }]; // Last entry is bogus
    strategies.__set__('win32LastTrustedLocation', trustedLoc); // But trusted is correct

    platformStub.get_location.callsFake((cb) => {
      cb(null, validNearby); // 10km from trusted
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

  it('recovery: processResponse updates trusted on every successful wifi', (done) => {
    const sendData = strategies.__get__('sendData');
    const needleStub = sinon.stub();
    const configStub2 = {
      getData: sinon.stub().callsFake((key) => {
        if (key === 'try_proxy') return null;
        if (key === 'control-panel.host') return 'panel.prey.example';
        return null;
      }),
    };

    strategies.__set__('config', configStub2);

    const accessPoints = [
      { mac_address: 'AA:BB:CC:11:22:33', ssid: 'test1', signal_strength: -50, channel: 1 },
      { mac_address: 'AA:BB:CC:44:55:66', ssid: 'test2', signal_strength: -40, channel: 6 },
    ];

    const endpointResponse = {
      endpoint: {
        url: 'https://example.com/loc',
        provider: 'test-provider',
        'user-agent': 'test-agent',
      },
    };

    const providerGeolocation = {
      location: {
        lat: -33.456,
        lng: -70.648,
        accuracy: 25,
      },
    };

    const needle = {
      post: sinon.stub()
        .onFirstCall()
        .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, endpointResponse))
        .onSecondCall()
        .callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200 }, providerGeolocation)),
      put: sinon.stub().callsFake((_url, _data, _opts, cb) => cb(null, { statusCode: 200, body: null })),
    };

    strategies.__set__('needle', needle);

    // Stub storage for processResponse
    storageStub.do.callsFake((operation, payload, cb) => {
      if (operation === 'query' && (payload.id === 'last_wifi_location' || payload.id === 'last_trusted_location')) {
        return cb(null, []);
      }
      if (operation === 'set') {
        if (payload.id === 'last_trusted_location') {
          capturedTrustedSave = payload.data ? JSON.parse(payload.data.value) : JSON.parse(payload.data);
        }
        return cb(null);
      }
      return cb(null);
    });

    sendData(accessPoints, (err, result) => {
      expect(err).to.be.null;
      expect(capturedTrustedSave).to.deep.equal({
        lat: providerGeolocation.location.lat,
        lng: providerGeolocation.location.lng,
        accuracy: providerGeolocation.location.accuracy,
        method: 'wifi',
      });
      done();
    });
  });
});
