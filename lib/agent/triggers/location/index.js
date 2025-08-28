/* eslint-disable consistent-return */
/* eslint-disable max-len */
const { join } = require('path');
const Emitter = require('events').EventEmitter;

const basePath = join(__dirname, '..', '..');
// eslint-disable-next-line import/no-dynamic-require
const hooks = require(join(basePath, 'hooks'));
const LatLon = require('./lib/latlng');
const devices = require('../../control-panel/api/devices');
const geo = require('../../providers/geo');
const config = require('../../../utils/configfile');
const storage = require('../../utils/storage');
const logger = require('../../common').logger.prefix('location');

let emitter;
let locCallbacks = [];
let current = {};
let checking = false;

const maxRetries = 3;
const accuracyThreshold = 200;
const timeToWaitForSecond = 60 * 1000;

const storeForceData = (type, query, cb) => {
  storage.do(type, query, (errSet) => {
    if (errSet) {
      logger.error('Error storing the last force location datetime');
      return cb(null, errSet);
    }
    cb();
  });
};

const checkOneDayDifference = (time, timeStoraged, cb) => {
  let timeDate;
  let timeStoragedDate;
  try {
    timeDate = new Date(time);
    timeStoragedDate = new Date(timeStoraged);
  } catch (ex) {
    return cb(false);
  }
  if (timeDate > timeStoragedDate) {
    if (timeDate.getDate() !== timeStoragedDate.getDate()) {
      return cb(true);
    }
  }
  cb(false);
};

const writeStorage = (local, cb) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'last_force_datetime' }, (err, stored) => {
    if (err) {
      logger.error('Error getting the last force location datetime');
      return cb(false, err);
    }
    if (stored && stored.length > 0) {
      const data = JSON.parse(stored[0].value);
      logger.debug(`Last force location datetime: ${JSON.stringify(data)}`);
      checkOneDayDifference(local, data.localDateTime, cb);
    } else {
      const dataToStore = { value: JSON.stringify({ localDateTime: local }) };
      storeForceData('set', { type: 'keys', id: 'last_force_datetime', data: dataToStore }, (errStoreSet) => {
        if (errStoreSet) return cb(null, new Error('Unable to set db keys last force location values'));
        cb(true);
      });
    }
  });
};

const postIt = (data, cb = null) => {
  if (!data || Object.keys(data).length === 0) {
    if (typeof cb === 'function') cb(new Error('no information provided.'));
    return;
  }

  logger.info('New location obtained! Making the Control Panel aware...');
  devices.post_location(data, (err, state) => {
    if (typeof cb === 'function') cb(err);
    if (err) return logger.error(`Unable to notify location: ${err?.message}`);
    if (state !== null && state !== undefined && state !== config.getData('control-panel.location_aware')) {
      config.setData('control-panel.location_aware', state);
    }
  });
};

const sendLocation = (typeSend, location, callBack = null) => {
  // stop here the fetchLocation('control-panel') execution. triggered by the got_location hook.
  if (typeSend === 'control-panel') return;
  // useful for "schedule" the got_location every 24 hours
  const data = {
    location,
  };

  // if the account/device has the location aware setting "on",
  // the location is sent to the control panel
  if (config.getData('control-panel.location_aware')) {
    postIt(data, callBack);
  } else {
    // check the current status of the location aware in the control panel
    devices.get.status((err, resp) => {
      const result = resp?.body ?? null;
      let aware = true;
      if (err || !result || (resp && resp.statusCode > 300)) {
        logger.info('Unable to sync location aware.');
      }
      // set the current value of location aware
      if (result?.settings?.local) {
        aware = result.settings.local.location_aware;
      }
      if (aware) postIt(data, callBack);
    });
  }
};

const callFetchLocation = (done, cb) => {
  geo.fetch_location((err, cords) => {
    const coords = cords;
    if (err || !coords || !emitter) { return done(new Error('Unable to get location')); }

    coords.lng = coords.lng.toString();
    coords.lat = coords.lat.toString();
    if (typeof cb === 'function') cb(coords);
  });
};

const fetchLocation = (typeFetch, callback) => {
  let callBackStored = null;
  if (typeFetch === 'force') callBackStored = { callback };
  if (callback && typeFetch !== 'force' && typeof callback === 'function') locCallbacks.push(callback);
  if (checking && typeFetch !== 'force') return;

  const fireCallbacks = (err, coords) => {
    if (callBackStored && (err || !coords)) callBackStored.callback(err, coords);
    const list = locCallbacks;
    list.forEach((fn) => {
      fn(err, coords);
    });
  };

  const done = (err, coords) => {
    if (locCallbacks.length >= 1) {
      fireCallbacks(err, coords);
    }
    locCallbacks = [];
    checking = false;
  };

  const triggerEvent = (typeTrigger, newLoc) => {
    const newLocation = newLoc;
    const event = 'new_location';

    if (Object.keys(current).length === 0 || typeTrigger === 'interval' || typeTrigger === 'force') {
      if (typeTrigger === 'force') newLocation.force = true;
      current = newLocation;
      exports.current = newLocation;
      done(null, current);
      sendLocation(typeTrigger, newLocation, callBackStored?.callback);
      return hooks.trigger(event, newLocation);
    }

    const p1 = new LatLon(current.lat, current.lng);
    const p2 = new LatLon(newLocation.lat, newLocation.lng);
    const distance = p1.distanceTo(p2) * 1000; // in meters

    newLocation.delta = distance;

    const betterLoc = () => {
      let isBetter = false;
      if (!current.accuracy && !!newLocation.accuracy) { isBetter = true; } else if (!!current.accuracy && !!newLocation.accuracy && newLocation.accuracy < current.accuracy) { isBetter = true; }
      return isBetter;
    };

    if (distance >= 30 || (distance < 30 && betterLoc())) {
      current = newLocation;
      exports.current = newLocation;
      sendLocation(typeTrigger, newLocation);
    }

    done(null, current);
    hooks.trigger(event, newLocation);
  };

  checking = true;
  const tryFetchLocation = (doneCallback, retryCount) => {
    callFetchLocation(doneCallback, (geoInfo) => {
      const coords = geoInfo;
      if (coords.accuracy) {
        if (coords.accuracy > accuracyThreshold) {
          if (typeFetch.localeCompare('client-start') === 0) {
            storage.do('query', { type: 'keys', column: 'id', data: 'recentlyUpdated' }, (err, stored) => {
              if ((err || (!stored || !(stored.length > 0)))) {
                coords.accuracy = coords.accuracy.toString();
                triggerEvent(typeFetch, coords);
                return;
              }
              if (stored && stored.length > 0) {
                const valueDate = new Date(stored[0].value);
                const difMilliseconds = (new Date()).getTime() - valueDate.getTime();
                const difMinutes = difMilliseconds / (1000 * 60);
                if (typeFetch.localeCompare('client-start') === 0 && difMinutes > 10) {
                  if ((retryCount + 1) < maxRetries) {
                    setTimeout(() => {
                      tryFetchLocation(doneCallback, retryCount + 1);
                    }, timeToWaitForSecond);
                    return;
                  }
                  // Si se llegó al máximo de intentos, continúa con la última coords
                }
                coords.accuracy = coords.accuracy.toString();
                triggerEvent(typeFetch, coords);
              }
            });
            return;
          }
          if (typeFetch.localeCompare('mac-address') === 0 || (typeFetch.localeCompare('force') === 0)) {
            if ((retryCount + 1) < maxRetries) {
              setTimeout(() => {
                tryFetchLocation(doneCallback, retryCount + 1);
              }, timeToWaitForSecond);
              return;
            }
          }
        }
        coords.accuracy = coords.accuracy.toString();
      }
      triggerEvent(typeFetch, coords);
    });
  };

  tryFetchLocation(done, 0);
};

const forceLocation = () => {
  const dataToUpdate = { localDateTime: new Date().toISOString() };
  writeStorage(dataToUpdate.localDateTime, (respWrite) => {
    if (!respWrite) return;
    fetchLocation('force', (err) => {
      if (err) return;
      storeForceData('update', {
        type: 'keys', id: 'last_force_datetime', columns: ['value'], values: [JSON.stringify(dataToUpdate)],
      }, (errStoredUpdate) => {
        if (errStoredUpdate) {
          logger.error('Unable to update db  keys last force location values');
          return;
        }
        logger.info('Updated db keys last force location values');
      });
    });
  });
};

exports.start = (opts, cb) => {
  hooks.on('mac_address_changed', () => {
    fetchLocation('mac-address');
  });

  hooks.on('get_location', (callback) => {
    if (typeof (callback) === 'function') { fetchLocation('control-panel', callback); } else fetchLocation(callback);
  });
  hooks.on('get_location_request', (callback) => {
    fetchLocation('interval', callback);
  });
  setTimeout(() => {
    fetchLocation('client-start');
  }, 10000);
  forceLocation();
  setInterval(() => forceLocation(), 1000 * 60 * 45);
  emitter = new Emitter();
  if (typeof cb === 'function') cb(null, emitter);
};

exports.stop = () => {
  hooks.remove('mac_address_changed');
  hooks.remove('get_location');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [];
exports.current = current;
exports.send_location = sendLocation;
exports.post_it = postIt;
exports.checkOneDayDifference = checkOneDayDifference;
exports.writeStorage = writeStorage;
