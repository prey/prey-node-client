const { join } = require('path');
const needle = require('needle');

// eslint-disable-next-line import/no-dynamic-require
const platform = require(join(__dirname, process.platform));
const common = require('../../common');
const providers = require('../../providers');
const keys = require('../../control-panel/api/keys');
const { storage, saveDataWifi } = require('../../utils/storage/utilstorage');
const LatLon = require('../../triggers/location/lib/latlng');

const logger = common.logger.prefix('geo');
const { system } = common;
const config = require('../../../utils/configfile');

const macAddressPattern = /^[0-9a-f]{1,2}([.:-])(?:[0-9a-f]{1,2}\1){4}[0-9a-f]{1,2}$/;

const GEO_ENDPOINT = `https://${config.getData('control-panel.host')}/geo`;
let proxy;

// win32 orchestration state
let win32FetchInProgress = false;
let win32PendingCallbacks = [];
let win32LastFetchTime = null;
/**
 * Retrieves the user's location using the geoip service.
 *
 * @param {function} cb - The callback function to handle the result.
 * @return {void} The function does not return anything.
 */
const geoip = (cb) => {
  logger.info('Getting location via geoip');
  // eslint-disable-next-line consistent-return
  needle.get('http://ipinfo.io/geo', (err, _resp, body) => {
    if (!body || !body.loc) {
      return cb(err || new Error('Unable to get location from IP.'));
    }
    logger.debug('Got location via geoip');
    const geoIPData = {
      lat: parseFloat(body.loc.split(',')[0]),
      lng: parseFloat(body.loc.split(',')[1]),
      method: 'geoip',
    };
    cb(null, geoIPData);
  });
};
/**
 * Parses the response body and returns it in the callback function.
 *
 * @param {object|string} body - The response body to parse.
 * @param {function} cb - The callback function to handle the parsed body.
 * @return {null|object|string} - Returns the parsed body in the callback function or an
 * error if parsing fails.
 */
const checkResponse = (body, cb) => {
  let output;

  if (typeof body === 'object') {
    output = body;
  } else {
    try {
      output = JSON.parse(body);
    } catch (e) {
      return cb(e);
    }
  }
  return cb(null, output);
};
/**
 * Processes the response received from the API.
 *
 * @param {Object} coords - The coordinates data received from the API.
 * @param {function} cb - The callback function to be called after processing the response.
 * @return {Object} The processed data object containing latitude, longitude, accuracy, and method.
 */
function processResponse(coords, cb) {
  if (!coords.location || (!coords.location.lat && !coords.location.latitude)) {
    return cb(new Error('Couldnt get any geoposition data. Try moving around a bit.'));
  }
  const data = {
    lat: coords.location.lat || coords.location.latitude,
    lng: coords.location.lng || coords.location.longitude,
    accuracy: coords.accuracy || coords.location.accuracy,
    method: 'wifi',
  };
  storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (err, rows) => {
    if (err) {
      logger.debug('Unable to read last_wifi_location data');
    } else if (rows && rows.length > 0) {
      storage.do('update', {
        type: 'keys', id: 'last_wifi_location', columns: 'value', values: JSON.stringify(data),
      }, (e) => { if (e) logger.debug('Unable to update last_wifi_location data'); });
    } else {
      storage.do('set', {
        type: 'keys', id: 'last_wifi_location', data: { value: JSON.stringify(data) },
      }, (e) => { if (e) logger.debug('Unable to save last_wifi_location data'); });
    }
  });
  return cb(null, data);
}

/**
 * Sends data to the location service.
 *
 * @param {Array} list - The list of data to be sent.
 * @param {Function} cb - The callback function to be called after sending the data.
 * @return {undefined}
 */
// eslint-disable-next-line consistent-return
const sendData = (list, cb) => {
  const dataWifiToSave = {
    list, result: '', error: '', partialEnd: '', date: (new Date()).toISOString(),
  };
  logger.debug('Sending AP data to location service');
  if (!(list && Array.isArray(list) && list.length > 1)) {
    dataWifiToSave.partialEnd = 'List - list doesnt have enough elements to try and filter';
    saveDataWifi(dataWifiToSave);
    return cb(new Error('No access points found.'));
  }
  list.sort((a, b) => a.signal_strength - b.signal_strength);
  // Filter only IANA reserved range (00:00:5E) which indicates fake/virtual MACs
  // Removed incorrect locally-administered bit check that was filtering valid APs
  const listBeforeFilter = list.filter((m) => m.mac_address.substr(0, 8).toUpperCase() !== '00:00:5E');
  // eslint-disable-next-line array-callback-return
  const filteredList = listBeforeFilter.map((wifiAccessPoint) => {
    let currentAccessPoint = null;
    if (wifiAccessPoint.mac_address
      && macAddressPattern.test(wifiAccessPoint.mac_address.toLowerCase()) === true) {
      currentAccessPoint = {
        macAddress: wifiAccessPoint.mac_address,
        ssid: wifiAccessPoint.ssid,
        signalStrength: wifiAccessPoint.signal_strength,
        channel: wifiAccessPoint.channel,
      };
    }
    return currentAccessPoint;
  }).filter((ap) => ap !== null);

  if (filteredList.length === 0) {
    dataWifiToSave.partialEnd = 'Filtered list is empty after MAC validation';
    saveDataWifi(dataWifiToSave);
    return cb(new Error('No valid access points found.'));
  }

  const dataWifiAccessPoints = {
    wifiAccessPoints: filteredList,
  };

  dataWifiToSave.dataWifiAccessPoints = dataWifiAccessPoints;
  proxy = config.getData('try_proxy');

  const opts = {
    user_agent: system.user_agent,
    username: keys.get().device,
    password: keys.get().api,
    json: true,
  };
  if (proxy) opts.proxy = proxy;

  // eslint-disable-next-line consistent-return
  needle.post(GEO_ENDPOINT, dataWifiAccessPoints, opts, (err, resp, body) => {
    try {
      if (err) {
        dataWifiToSave.error = JSON.stringify(err);
        const statusCode = resp && resp.statusCode ? resp.statusCode : 'unknown';
        dataWifiToSave.partialEnd = `needle.post - Error after POST ${GEO_ENDPOINT} - Status code: ${statusCode}`;
        saveDataWifi(dataWifiToSave);
        return cb(err);
      }
      if (resp && resp.statusCode === 429) {
        storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (errorStorage, storedData) => {
          if (errorStorage) return cb(new Error('Unable to read geo data'));
          if (storedData && storedData.length === 0) return cb(new Error('There is no geo data in DB'));
          try {
            dataWifiToSave.result = storedData[0].value;
            const statusCode = resp && resp.statusCode ? resp.statusCode : 'unknown';
            dataWifiToSave.partialEnd = `needle.post - Error after POST ${GEO_ENDPOINT} - Status code: ${statusCode}`;
            saveDataWifi(dataWifiToSave);
            return cb(null, JSON.parse(storedData[0].value));
          } catch (e) {
            throw new Error('Couldnt get data in sqlite storage geo');
          }
        });
      }
      // eslint-disable-next-line consistent-return
      checkResponse(body, (errCheckResponse, stdout) => {
        if (errCheckResponse) {
          dataWifiToSave.error = JSON.stringify(errCheckResponse);
          const statusCode = resp && resp.statusCode ? resp.statusCode : 'unknown';
          dataWifiToSave.partialEnd = `checkResponse - Error after POST ${GEO_ENDPOINT} - Status code: ${statusCode}`;
          dataWifiToSave.result = JSON.stringify(stdout);
          saveDataWifi(dataWifiToSave);
          return cb(errCheckResponse);
        }

        // If the response includes the location already it's immediately processed
        if (stdout.geolocation) {
          dataWifiToSave.result = JSON.stringify(stdout.geolocation);
          const statusCode = resp && resp.statusCode ? resp.statusCode : 'unknown';
          dataWifiToSave.partialEnd = `checkResponse - Got geolocation as the response from POST ${GEO_ENDPOINT} - Status code: ${statusCode}`;
          saveDataWifi(dataWifiToSave);
          return processResponse(stdout.geolocation, cb);
        }

        if (!stdout.endpoint) {
          dataWifiToSave.error = JSON.stringify(errCheckResponse);
          const statusCode = resp && resp.statusCode ? resp.statusCode : 'unknown';
          dataWifiToSave.partialEnd = `checkResponse - No endpoint or geolocation at response from POST ${GEO_ENDPOINT} - Status code: ${statusCode}`;
          saveDataWifi(dataWifiToSave);
          return cb(new Error('No location endpoint available'));
        }
        const { url } = stdout.endpoint;
        const { provider } = stdout.endpoint;

        const options = {
          user_agent: stdout.endpoint['user-agent'],
          json: true,
        };
        if (proxy) options.proxy = proxy;
        // Get the location using the url and mac addresses data;
        // eslint-disable-next-line consistent-return
        const dataWifiConsiderIp = { ...dataWifiAccessPoints, considerIp: 'true' };
        // eslint-disable-next-line consistent-return
        needle.post(url, dataWifiConsiderIp, options, (errorPostUrl, _resp, bodyPostUrl) => {
          if (errorPostUrl) {
            dataWifiToSave.error = JSON.stringify(errorPostUrl);
            const statusCode = _resp && _resp.statusCode ? _resp.statusCode : 'unknown';
            dataWifiToSave.partialEnd = `Second needle.post - Error from POST ${url} - Status code: ${statusCode}`;
            saveDataWifi(dataWifiToSave);
            logger.info(`strategies err: ${JSON.stringify(errorPostUrl)}`);
            return cb(errorPostUrl);
          }
          if (bodyPostUrl && bodyPostUrl.error) {
            dataWifiToSave.error = JSON.stringify(bodyPostUrl);
            const statusCode = _resp && _resp.statusCode ? _resp.statusCode : 'unknown';
            dataWifiToSave.partialEnd = `Second needle.post - Error in bodyPostUrl from POST ${url} - Status code: ${statusCode}`;
            saveDataWifi(dataWifiToSave);
            logger.info(`Error in bodyPostUrl: ${JSON.stringify(bodyPostUrl)}`);
            return cb(errorPostUrl);
          }
          // eslint-disable-next-line consistent-return
          checkResponse(bodyPostUrl, (errorCheckResponse, stdoutCheckResponse) => {
            if (errorCheckResponse) {
              return cb(errorCheckResponse);
            }
            const geolocation = stdoutCheckResponse;
            const locData = {
              geolocation,
              wifiAccessPoints: filteredList,
              provider,
            };
            const optsPut = {
              user_agent: system.user_agent,
              json: true,
              username: keys.get().device,
              password: keys.get().api,
            };
            if (proxy) optsPut.proxy = proxy;
            // Send the new location info and process it
            // eslint-disable-next-line consistent-return
            needle.put(GEO_ENDPOINT, locData, optsPut, (errPut, respPut) => {
              logger.debug('Sending location data to prey service');
              if (errPut) {
                const statusCode = _resp && _resp.statusCode ? _resp.statusCode : 'unknown';
                dataWifiToSave.error = `error service ${GEO_ENDPOINT}  PUT: ${JSON.stringify(errPut)} - Status code: ${statusCode}`;
                dataWifiToSave.partialEnd = `needle.put - Error from PUT ${GEO_ENDPOINT}`;
                saveDataWifi(dataWifiToSave);
                logger.info(`error service ${GEO_ENDPOINT}  PUT: ${JSON.stringify(errPut)}`);
                return cb(errPut);
              }
              // Use server-verified location if the geoloc service returned a corrected one
              const verifiedLocation = respPut.body && respPut.body.location ? respPut.body : null;
              const finalLocation = verifiedLocation || geolocation;
              if (verifiedLocation) {
                logger.info('Using server-verified location instead of original');
              }
              dataWifiToSave.result = JSON.stringify(finalLocation);
              dataWifiToSave.partialEnd = `needle.put - Send geolocation to PUT ${GEO_ENDPOINT}`;
              saveDataWifi(dataWifiToSave);
              processResponse(finalLocation, cb);
            });
          });
        });
      });
    } catch (exception) {
      return cb(exception);
    }
  });
};
/**
* Retrieves location information using the wifi strategy.
*
* @param {function} cb - The callback function to be executed after retrieving the
location information.
* @return {type} description of return value
*/
const wifi = (cb) => {
  logger.info('Getting location via wifi strategy');
  const dataWifiToSave = {
    list: [], result: '', error: '', partialEnd: '', date: (new Date()).toISOString(),
  };
  // eslint-disable-next-line consistent-return
  providers.get('access_points_list', (err, list) => {
    if (err) {
      dataWifiToSave.error = JSON.stringify(err);
      dataWifiToSave.partialEnd = 'access_points_list - Error at access_points_list';
      saveDataWifi(dataWifiToSave);
      return cb(err);
    }
    sendData(list, cb);
  });
};
/**
 * Retrieves the user's location using the native geolocation method.
 *
 * @param {function} cb - The callback function to be executed after retrieving the location.
 * @return {void}
 */
const native = (cb) => {
  logger.info('Getting location via native geoloc');
  platform.get_location((err, res) => {
    if (err) return cb(err);
    logger.debug('Got location via native geoloc');
    // Avoid adding property in each native geoloc implementation
    res.method = 'native';
    return cb(null, res);
  });
};

const askLocationNativePermission = (cb) => {
  platform.askLocationNativePermission(cb);
};

// --- win32 orchestration helpers ---

const calcDistanceKm = (loc1, loc2) => {
  const p1 = new LatLon(loc1.lat, loc1.lng);
  const p2 = new LatLon(loc2.lat, loc2.lng);
  return Number.parseFloat(p1.distanceTo(p2));
};

const pickBestAccuracy = (locA, locB) => {
  const accA = typeof locA.accuracy === 'number' ? locA.accuracy : Infinity;
  const accB = typeof locB.accuracy === 'number' ? locB.accuracy : Infinity;
  return accA <= accB ? locA : locB;
};

const getLocationHistory = (cb) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'location_history_win32' }, cb);
};

const parseHistory = (rows) => {
  if (!rows || rows.length === 0) return [];
  try { return JSON.parse(rows[0].value) || []; } catch (e) { logger.debug(`Failed to parse location_history_win32: ${e.message}`); return []; }
};

const saveToLocationHistory = (location, cb) => {
  getLocationHistory((err, rows) => {
    if (err) return cb(err);
    const history = parseHistory(rows);
    history.push(location);
    if (history.length > 20) history.splice(0, history.length - 20);
    const value = JSON.stringify(history);
    if (rows && rows.length > 0) {
      storage.do('update', {
        type: 'keys', id: 'location_history_win32', columns: 'value', values: value,
      }, cb);
    } else {
      storage.do('set', {
        type: 'keys', id: 'location_history_win32', data: { id: 'location_history_win32', value },
      }, cb);
    }
  });
};

const drainWin32Callbacks = (err, result) => {
  win32FetchInProgress = false;
  const cbs = win32PendingCallbacks.splice(0);
  cbs.forEach((fn) => fn(err, result));
};

// --- win32 bootstrap (first location: seed history with wifi) ---

const bootstrapWin32Location = (cb) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (err, rows) => {
    if (!err && rows && rows.length > 0) {
      let existing;
      try { existing = JSON.parse(rows[0].value); } catch (e) { logger.debug(`Failed to parse last_wifi_location: ${e.message}`); existing = null; }
      if (existing && typeof existing.lat === 'number') {
        logger.info('Bootstrap: seeding history from existing last_wifi_location');
        return saveToLocationHistory(existing, (saveErr) => cb(saveErr, existing));
      }
    }
    logger.info('Bootstrap: no last_wifi_location, fetching via wifi');
    wifi((wifiErr, wifiResult) => {
      if (wifiErr) return cb(wifiErr);
      saveToLocationHistory(wifiResult, (saveErr) => cb(saveErr, wifiResult));
    });
  });
};

// --- win32 normal path (second location onwards: native-first with jump detection) ---

const normalWin32Location = (lastValid, cb, timeoutFn) => {
  let retried = false;

  // eslint-disable-next-line consistent-return
  const attemptNative = () => {
    platform.get_location((err, result) => {
      const accuracyOk = !err
        && (result.accuracy === null
          || !Number.isFinite(result.accuracy)
          || result.accuracy <= 100);

      if (!accuracyOk) {
        if (!retried) {
          retried = true;
          logger.info('Native accuracy >100m or error, retrying in 30s...');
          return timeoutFn(attemptNative, 30000);
        }
        logger.info('Native failed on retry, falling back to wifi');
        return wifi((wifiErr, wifiResult) => {
          if (wifiErr) return cb(wifiErr);
          saveToLocationHistory(wifiResult, (saveErr) => cb(saveErr, wifiResult));
        });
      }

      const resultWithMethod = { ...result, method: 'native' };
      const distance = calcDistanceKm(resultWithMethod, lastValid);
      logger.info(`Native location ok. Distance from last valid: ${distance}km`);

      if (distance <= 50) {
        return saveToLocationHistory(resultWithMethod, (saveErr) => cb(saveErr, resultWithMethod));
      }

      logger.info('Jump >50km detected, confirming with wifi...');
      const nativeCandidate = resultWithMethod;
      wifi((wifiErr, wifiResult) => {
        if (wifiErr) {
          logger.info('Wifi confirmation failed, using native candidate');
          return saveToLocationHistory(nativeCandidate, (saveErr) => cb(saveErr, nativeCandidate));
        }
        const wifiDistance = calcDistanceKm(wifiResult, lastValid);
        if (wifiDistance > 50) {
          logger.info('Wifi confirms jump, picking best accuracy');
          const best = pickBestAccuracy(nativeCandidate, wifiResult);
          return saveToLocationHistory(best, (saveErr) => cb(saveErr, best));
        }
        logger.info('Wifi does not confirm jump, using wifi result');
        saveToLocationHistory(wifiResult, (saveErr) => cb(saveErr, wifiResult));
      });
    });
  };

  attemptNative();
};

// --- win32 main entry point (cache + concurrency guard + routing) ---

const startWin32Fetch = (cb, timeoutFn) => {
  win32PendingCallbacks.push(cb);
  if (win32FetchInProgress) return;
  win32FetchInProgress = true;

  getLocationHistory((_histErr, rows) => {
    const history = parseHistory(rows);
    if (history.length === 0) {
      bootstrapWin32Location((err, result) => {
        if (!err) win32LastFetchTime = Date.now();
        drainWin32Callbacks(err, result);
      });
    } else {
      const lastValid = history[history.length - 1];
      normalWin32Location(lastValid, (err, result) => {
        if (!err) win32LastFetchTime = Date.now();
        drainWin32Callbacks(err, result);
      }, timeoutFn);
    }
  });
};

// eslint-disable-next-line default-param-last
const win32LocationFetch = (cb, timeoutFn = setTimeout) => {
  if (win32LastFetchTime && (Date.now() - win32LastFetchTime) < 60000) {
    return getLocationHistory((err, rows) => {
      if (!err) {
        const history = parseHistory(rows);
        if (history.length > 0) {
          logger.info('Returning cached location (within 1-minute window)');
          return cb(null, history[history.length - 1]);
        }
      }
      startWin32Fetch(cb, timeoutFn);
    });
  }
  startWin32Fetch(cb, timeoutFn);
};

module.exports = {
  geoip,
  wifi,
  native,
  askLocationNativePermission,
  win32LocationFetch,
};
