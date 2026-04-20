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
const win32PendingCallbacks = [];
let win32LastFetchTime = null;
let win32LastTrustedLocation = null; // ← NEW: Baseline confirmado por WiFi
let win32NativeOnlyCount = 0; // ← NEW: Contador para validación periódica
logger.debug('[WIN32-CONCURRENCY] Module initialized: no active fetch');
logger.debug('[WIN32-TRUSTED] Trusted location mechanism initialized');
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
  logger.debug(`[WIN32-WIFI] Processing response: lat=${data.lat}, lng=${data.lng}, accuracy=${data.accuracy}m`);

  // NEW: Update trusted location on every successful WiFi response
  win32LastTrustedLocation = data;
  logger.debug(`[WIN32-TRUSTED] Updated trusted location: lat=${data.lat}, lng=${data.lng} (via WiFi)`);
  storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (err, rows) => {
    if (err) {
      logger.debug('[WIN32-WIFI-STORAGE] Unable to read last_wifi_location data');
    } else if (rows && rows.length > 0) {
      storage.do('update', {
        type: 'keys', id: 'last_wifi_location', columns: 'value', values: JSON.stringify(data),
      }, (e) => { if (e) logger.debug('[WIN32-WIFI-STORAGE] Unable to update last_wifi_location'); else logger.debug('[WIN32-WIFI-STORAGE] Updated last_wifi_location'); });
    } else {
      storage.do('set', {
        type: 'keys', id: 'last_wifi_location', data: { value: JSON.stringify(data) },
      }, (e) => { if (e) logger.debug('[WIN32-WIFI-STORAGE] Unable to set last_wifi_location'); else logger.debug('[WIN32-WIFI-STORAGE] Created last_wifi_location (first time)'); });
    }
  });

  // NEW: Persist trusted location to storage
  storage.do('query', { type: 'keys', column: 'id', data: 'last_trusted_location' }, (err, rows) => {
    if (err) {
      logger.debug('[WIN32-TRUSTED-STORAGE] Unable to read last_trusted_location');
    } else if (rows && rows.length > 0) {
      storage.do('update', {
        type: 'keys', id: 'last_trusted_location', columns: 'value', values: JSON.stringify(data),
      }, (e) => { if (e) logger.debug('[WIN32-TRUSTED-STORAGE] Unable to update last_trusted_location'); else logger.debug('[WIN32-TRUSTED-STORAGE] Persisted trusted location'); });
    } else {
      storage.do('set', {
        type: 'keys', id: 'last_trusted_location', data: { id: 'last_trusted_location', value: JSON.stringify(data) },
      }, (e) => { if (e) logger.debug('[WIN32-TRUSTED-STORAGE] Unable to set last_trusted_location'); else logger.debug('[WIN32-TRUSTED-STORAGE] Created last_trusted_location'); });
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
  const distance = Number.parseFloat(p1.distanceTo(p2));
  logger.debug(`[WIN32-DISTANCE] Calculated: ${distance.toFixed(2)}km from (${loc1.lat},${loc1.lng}) to (${loc2.lat},${loc2.lng})`);
  return distance;
};

const pickBestAccuracy = (locA, locB) => {
  const accA = typeof locA.accuracy === 'number' ? locA.accuracy : Infinity;
  const accB = typeof locB.accuracy === 'number' ? locB.accuracy : Infinity;
  return accA <= accB ? locA : locB;
};

const getLocationHistory = (cb) => {
  logger.debug('[WIN32-HISTORY] Querying location_history_win32 from storage');
  storage.do('query', { type: 'keys', column: 'id', data: 'location_history_win32' }, (err, rows) => {
    if (err) logger.debug('[WIN32-HISTORY] Error reading history');
    else logger.debug(`[WIN32-HISTORY] Retrieved ${rows && rows.length > 0 ? 'record exists' : 'no record'}`);
    cb(err, rows);
  });
};

const parseHistory = (rows) => {
  if (!rows || rows.length === 0) {
    logger.debug('[WIN32-HISTORY-PARSE] No rows, returning empty history');
    return [];
  }
  try {
    const history = JSON.parse(rows[0].value) || [];
    logger.debug(`[WIN32-HISTORY-PARSE] Parsed ${history.length} entries`);
    return history;
  } catch (e) {
    logger.debug(`[WIN32-HISTORY-PARSE] ERROR: Failed to parse: ${e.message}`);
    return [];
  }
};

const saveToLocationHistory = (location, cb) => {
  getLocationHistory((err, rows) => {
    if (err) return cb(err);
    const history = parseHistory(rows);
    history.push(location);
    logger.debug(`[WIN32-HISTORY-SAVE] Added location (lat=${location.lat}, lng=${location.lng}). Total entries: ${history.length}`);
    if (history.length > 15) {
      const removed = history.length - 15;
      history.splice(0, removed);
      logger.debug(`[WIN32-HISTORY-SAVE] Truncated history (removed oldest ${removed} entries, keeping max 15)`);
    }
    const value = JSON.stringify(history);
    if (rows && rows.length > 0) {
      logger.debug('[WIN32-HISTORY-SAVE] Updating existing history record');
      storage.do('update', {
        type: 'keys', id: 'location_history_win32', columns: 'value', values: value,
      }, (e) => {
        if (e) logger.debug('[WIN32-HISTORY-SAVE] ERROR: Update failed');
        else logger.debug('[WIN32-HISTORY-SAVE] Update successful');
        cb(e);
      });
    } else {
      logger.debug('[WIN32-HISTORY-SAVE] Creating new history record (first time)');
      storage.do('set', {
        type: 'keys', id: 'location_history_win32', data: { id: 'location_history_win32', value },
      }, (e) => {
        if (e) logger.debug('[WIN32-HISTORY-SAVE] ERROR: Set failed');
        else logger.debug('[WIN32-HISTORY-SAVE] Set successful');
        cb(e);
      });
    }
  });
};

const drainWin32Callbacks = (err, result) => {
  win32FetchInProgress = false;
  const cbs = win32PendingCallbacks.splice(0);
  logger.debug(`[WIN32-CONCURRENCY] Draining ${cbs.length} pending callback(s). Fetch complete. ${err ? `ERROR: ${err.message}` : 'SUCCESS'}`);
  // NEW: Log trusted status on drain
  if (!err && win32LastTrustedLocation) {
    logger.debug(`[WIN32-TRUSTED] Drain: Trusted location is valid (lat=${win32LastTrustedLocation.lat}, lng=${win32LastTrustedLocation.lng})`);
  }
  cbs.forEach((fn) => fn(err, result));
};

// --- win32 bootstrap (first location: seed history with wifi) ---

const bootstrapWin32Location = (cb) => {
  logger.debug('[WIN32-BOOTSTRAP] Starting bootstrap (first location, empty history)');
  storage.do('query', { type: 'keys', column: 'id', data: 'last_wifi_location' }, (err, rows) => {
    if (!err && rows && rows.length > 0) {
      let existing;
      try {
        existing = JSON.parse(rows[0].value);
        logger.debug(`[WIN32-BOOTSTRAP] Found last_wifi_location: lat=${existing?.lat}, lng=${existing?.lng}`);
      } catch (e) {
        logger.debug(`[WIN32-BOOTSTRAP] ERROR parsing last_wifi_location: ${e.message}`);
        existing = null;
      }
      if (existing && typeof existing.lat === 'number') {
        // NEW: Set trusted location from existing WiFi location
        win32LastTrustedLocation = existing;
        logger.info('[WIN32-BOOTSTRAP] Seeding history from existing last_wifi_location (no network call)');
        logger.debug('[WIN32-TRUSTED] Bootstrap initialized trusted from last_wifi_location');
        // Persist trusted to storage
        storage.do('set', {
          type: 'keys', id: 'last_trusted_location', data: { value: JSON.stringify(existing) },
        }, (e) => {
          if (e) logger.debug('[WIN32-TRUSTED-STORAGE] Unable to set last_trusted_location in bootstrap');
        });
        return saveToLocationHistory(existing, (saveErr) => cb(saveErr, existing));
      }
    }
    logger.info('[WIN32-BOOTSTRAP] No last_wifi_location found, fetching fresh location via wifi');
    wifi((wifiErr, wifiResult) => {
      if (wifiErr) {
        logger.debug('[WIN32-BOOTSTRAP] ERROR: Wifi fetch failed during bootstrap');
        return cb(wifiErr);
      }
      logger.debug(`[WIN32-BOOTSTRAP] Wifi fetch successful: lat=${wifiResult.lat}, lng=${wifiResult.lng}`);
      // NEW: Set trusted location from fresh WiFi fetch
      win32LastTrustedLocation = wifiResult;
      logger.debug('[WIN32-TRUSTED] Bootstrap initialized trusted from fresh WiFi fetch');
      // Persist trusted to storage
      storage.do('set', {
        type: 'keys', id: 'last_trusted_location', data: { value: JSON.stringify(wifiResult) },
      }, (e) => {
        if (e) logger.debug('[WIN32-TRUSTED-STORAGE] Unable to set last_trusted_location in bootstrap');
      });
      saveToLocationHistory(wifiResult, (saveErr) => cb(saveErr, wifiResult));
    });
  });
};

// --- win32 normal path (second location onwards: native-first with jump detection) ---

const normalWin32Location = (lastValid, cb, timeoutFn) => {
  let retried = false;
  logger.debug(`[WIN32-NORMAL] Starting normal location fetch. Last valid: lat=${lastValid.lat}, lng=${lastValid.lng}`);
  logger.debug(`[WIN32-TRUSTED] Using trusted baseline: lat=${win32LastTrustedLocation?.lat}, lng=${win32LastTrustedLocation?.lng}`);

  // eslint-disable-next-line consistent-return
  const attemptNative = () => {
    logger.debug('[WIN32-NORMAL] Attempting native geolocation...');
    platform.get_location((err, result) => {
      const accuracyOk = !err
        && (result.accuracy === null
          || !Number.isFinite(result.accuracy)
          || result.accuracy <= 100);

      if (!accuracyOk) {
        if (!retried) {
          retried = true;
          logger.info(`[WIN32-NORMAL] Native accuracy issue (accuracy=${result?.accuracy}m, error=${err?.message || 'none'}). Retrying in 30s...`);
          return timeoutFn(attemptNative, 30000);
        }
        logger.info('[WIN32-NORMAL] Native failed on retry, falling back to wifi');
        win32NativeOnlyCount = 0; // NEW: Reset counter on fallback
        return wifi((wifiErr, wifiResult) => {
          if (wifiErr) {
            logger.debug('[WIN32-NORMAL] ERROR: Both native and wifi failed');
            return cb(wifiErr);
          }
          logger.debug(`[WIN32-NORMAL-FALLBACK] Using wifi result: lat=${wifiResult.lat}, lng=${wifiResult.lng}`);
          saveToLocationHistory(wifiResult, (saveErr) => cb(saveErr, wifiResult));
        });
      }

      const resultWithMethod = { ...result, method: 'native' };
      logger.debug(`[WIN32-NORMAL] Native successful: lat=${resultWithMethod.lat}, lng=${resultWithMethod.lng}, accuracy=${resultWithMethod.accuracy}m`);

      // NEW: Compare against TRUSTED location instead of lastValid
      const trustedRef = win32LastTrustedLocation || lastValid;
      const distance = calcDistanceKm(resultWithMethod, trustedRef);
      logger.debug(`[WIN32-NORMAL] Distance from trusted: ${distance.toFixed(2)}km`);

      if (distance <= 50) {
        logger.debug(`[WIN32-NORMAL] Distance OK (${distance.toFixed(2)}km ≤ 50km). Accepting native result.`);
        // NEW: Increment native-only counter
        win32NativeOnlyCount++;
        logger.debug(`[WIN32-VALIDATE] Native-only count: ${win32NativeOnlyCount}/3`);

        // NEW: Periodic validation every 3 cycles
        if (win32NativeOnlyCount >= 3) {
          logger.info('[WIN32-VALIDATE] Trigger periodic validation with WiFi');
          wifi((wifiErr, wifiResult) => {
            win32NativeOnlyCount = 0; // Reset counter
            if (wifiErr) {
              logger.debug('[WIN32-VALIDATE] Periodic validation: WiFi failed, keeping trusted as-is');
            } else {
              // NEW: Update trusted location from successful WiFi
              win32LastTrustedLocation = wifiResult;
              logger.info(`[WIN32-VALIDATE] Periodic validation: WiFi successful, trusted updated to lat=${wifiResult.lat}, lng=${wifiResult.lng}`);
            }
          });
        }

        return saveToLocationHistory(resultWithMethod, (saveErr) => cb(saveErr, resultWithMethod));
      }

      logger.info(`[WIN32-NORMAL] Jump detected (${distance.toFixed(2)}km > 50km). Confirming with wifi...`);
      win32NativeOnlyCount = 0; // NEW: Reset counter on jump detection
      const nativeCandidate = resultWithMethod;
      wifi((wifiErr, wifiResult) => {
        if (wifiErr) {
          logger.info('[WIN32-NORMAL-JUMP] Wifi confirmation failed. Using native candidate anyway.');
          return saveToLocationHistory(nativeCandidate, (saveErr) => cb(saveErr, nativeCandidate));
        }
        // NEW: Compare WiFi against TRUSTED, not lastValid
        const wifiDistance = calcDistanceKm(wifiResult, trustedRef);
        if (wifiDistance > 50) {
          logger.info(`[WIN32-NORMAL-JUMP] Wifi confirms jump (${wifiDistance.toFixed(2)}km). Picking best accuracy between native and wifi.`);
          const best = pickBestAccuracy(nativeCandidate, wifiResult);
          logger.debug(`[WIN32-NORMAL-JUMP] Selected: ${best.method} (accuracy=${best.accuracy}m)`);
          // NEW: Update trusted on confirmed jump
          win32LastTrustedLocation = best;
          logger.debug('[WIN32-TRUSTED] Updated trusted after confirmed jump');
          return saveToLocationHistory(best, (saveErr) => cb(saveErr, best));
        }
        logger.info(`[WIN32-NORMAL-JUMP] Wifi does NOT confirm jump (${wifiDistance.toFixed(2)}km ≤ 50km). Using wifi result instead (native was probably spurious).`);
        // NEW: Update trusted on jump resolution
        win32LastTrustedLocation = wifiResult;
        logger.debug('[WIN32-TRUSTED] Updated trusted after jump resolution (WiFi)');
        saveToLocationHistory(wifiResult, (saveErr) => cb(saveErr, wifiResult));
      });
    });
  };

  attemptNative();
};

// --- win32 main entry point (cache + concurrency guard + routing) ---

const startWin32Fetch = (cb, timeoutFn) => {
  win32PendingCallbacks.push(cb);
  if (win32FetchInProgress) {
    logger.debug(`[WIN32-CONCURRENCY] Fetch already in progress. Queued callback (now ${win32PendingCallbacks.length} pending).`);
    return;
  }
  win32FetchInProgress = true;
  logger.debug('[WIN32-CONCURRENCY] Fetch starting. No other fetch in progress.');

  // NEW: Load trusted location from storage on startup
  storage.do('query', { type: 'keys', column: 'id', data: 'last_trusted_location' }, (errTrusted, trustedRows) => {
    if (!errTrusted && trustedRows && trustedRows.length > 0) {
      try {
        const trusted = JSON.parse(trustedRows[0].value);
        if (trusted && typeof trusted.lat === 'number') {
          win32LastTrustedLocation = trusted;
          logger.debug(`[WIN32-TRUSTED] Loaded from storage: lat=${trusted.lat}, lng=${trusted.lng}`);
        }
      } catch (e) {
        logger.debug(`[WIN32-TRUSTED] ERROR loading from storage: ${e.message}`);
      }
    }

    getLocationHistory((_histErr, rows) => {
      const history = parseHistory(rows);
      if (history.length === 0) {
        logger.debug('[WIN32-START] History empty → routing to BOOTSTRAP');
        bootstrapWin32Location((err, result) => {
          if (!err) win32LastFetchTime = Date.now();
          drainWin32Callbacks(err, result);
        });
      } else {
        logger.debug(`[WIN32-START] History has ${history.length} entries → routing to NORMAL`);
        const lastValid = history[history.length - 1];
        normalWin32Location(lastValid, (err, result) => {
          if (!err) win32LastFetchTime = Date.now();
          drainWin32Callbacks(err, result);
        }, timeoutFn);
      }
    });
  });
};

// eslint-disable-next-line default-param-last
const win32LocationFetch = (cb, timeoutFn = setTimeout) => {
  const now = Date.now();
  const timeSinceLastFetch = win32LastFetchTime ? now - win32LastFetchTime : Infinity;
  const cacheValid = win32LastFetchTime && timeSinceLastFetch < 60000;

  if (cacheValid) {
    logger.debug(`[WIN32-CACHE] Cache hit (${(timeSinceLastFetch / 1000).toFixed(1)}s ago < 60s). Reading from history...`);
    return getLocationHistory((err, rows) => {
      if (!err) {
        const history = parseHistory(rows);
        if (history.length > 0) {
          const cached = history[history.length - 1];
          logger.info(`[WIN32-CACHE] Returning cached: lat=${cached.lat}, lng=${cached.lng} (${(timeSinceLastFetch / 1000).toFixed(1)}s old)`);
          return cb(null, cached);
        }
      }
      logger.debug('[WIN32-CACHE] Cache hit but history empty (edge case). Falling back to fetch.');
      startWin32Fetch(cb, timeoutFn);
    });
  }

  const msg = win32LastFetchTime
    ? `${(timeSinceLastFetch / 1000).toFixed(1)}s ago > 60s`
    : 'first fetch';
  logger.debug(`[WIN32-CACHE] Cache expired or not set (${msg}). Starting new fetch...`);
  startWin32Fetch(cb, timeoutFn);
};

module.exports = {
  geoip,
  wifi,
  native,
  askLocationNativePermission,
  win32LocationFetch,
};
