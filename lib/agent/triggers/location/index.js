/* eslint-disable consistent-return */
/* eslint-disable max-len */
const { join } = require('path');
const Emitter = require('events').EventEmitter;
const https = require('https');

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
let lastSentTime;

const accuracyThreshold = 50;
const timeToWaitForSecond = 60 * 1000;

const getCurrentTime = (cb) => {
  const options = {
    hostname: 'timeapi.io',
    path: '/api/time/current/zone?timeZone=GMT',
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      cb(JSON.parse(data));
    });
  });

  req.on('error', (error) => {
    cb(null, error);
  });

  req.end();
}

const storeForceData = (type, query, cb) => {
  storage.do(type, query, (errSet) => {
    if (errSet) {
      logger.error('Error storing the last force location datetime');
      return cb(null, errSet);
    }
    logger.info('Stored referential first connection time');
    return cb(true);
  });
}

const dateDifference = (date, secondDate) => {
  const timeDiff = date.getTime() - secondDate.getTime();
  const diffHours = timeDiff / (1000 * 3600);
  return diffHours;
};

const check24TimeLoop = (time, timeStoraged, cb) => {
  const dateTime = new Date(time);
  const dateTimeStoraged = new Date(timeStoraged);
  const diff = dateDifference(dateTime, dateTimeStoraged);
  logger.info(`Diff: ${diff}`);
  if (diff > 24) {
    logger.info('24 hours has passed since the last force location datetime.');
    cb(true);
  } else cb(false);
}

const writeStorage = (external, local, cb) => {
  storage.do('query', { type: 'keys', column: 'id', data: 'last_force_datetime' }, (err, stored) => {
    if (err) logger.error('Error getting the last force location datetime');
    if (stored && stored.length > 0) {
      const data = JSON.parse(stored[0].value);
      logger.info(`Last force location datetime: ${data}`);
      if ((external === null || data.externalDateTime === 'null')) {
        check24TimeLoop(local, data.localDateTime, cb);
      } else {
        check24TimeLoop(external, data.externalDateTime, cb);
      }
    } else {
      const dataToStore = { value: { localDateTime: local, externalDateTime: external }};
      storeForceData('set', { type: 'keys', id: 'last_force_datetime', data: dataToStore }, (err) => {
        if (err) return cb(null, new Error("Unable to set db keys last force location values"));
        return cb(true);
      });
    }
  });
};

const postIt = (data, cb = null) => {
  if (!data || Object.keys(data).length === 0) return;

  logger.info('New location obtained! Making the Control Panel aware...');
  devices.post_location(data, (err, state) => {
    if (typeof cb === 'function') cb(err);
    if (err) return logger.error(`Unable to notify location: ${err?.message}`);
    if (state !== null && state !== undefined && state !== config.getData('control-panel.location_aware')) {
      config.setData('control-panel.location_aware', state);
    }
  });
};

const sendLocation = (typeSend, location) => {
  // stop here the fetchLocation('control-panel') execution. triggered by the got_location hook.
  if (typeSend === 'control-panel') return;
  // useful for "schedule" the got_location every 24 hours
  lastSentTime = Date.now();
  const data = {
    location,
  };

  // if the account/device has the location aware setting "on",
  // the location is sent to the control panel
  if (config.getData('control-panel.location_aware')) {
    postIt(data);
  } else {
    // check the current status of the location aware in the control panel
    devices.get.status((err, resp) => {
      const result = resp?.body;
      let aware = true;
      if (err || !result || (resp && resp.statusCode > 300)) {
        logger.info('Unable to sync location aware.');
      }

      // set the current value of location aware
      if (result && result.settings && result.settings.local) {
        aware = result.settings.local.location_aware;
      }
      if (aware) postIt(data);
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
  if (callback && typeof callback === 'function') locCallbacks.push(callback);
  if (checking) return;

  const fireCallbacks = (err, coords) => {
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

    if (Object.keys(current).length === 0 || typeTrigger === 'interval') {
      current = newLocation;
      exports.current = newLocation;
      done(null, current);
      sendLocation(typeTrigger, newLocation);
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
  callFetchLocation(done, (geoInfo) => {
    const coords = geoInfo;
    if (coords.accuracy) {
      if (typeFetch.localeCompare('client-start') === 0 && coords.accuracy > accuracyThreshold) {
        setTimeout(() => {
          callFetchLocation(done, (geoInfoInside) => {
            const coordsInside = geoInfoInside;
            if (coordsInside.accuracy) {
              coordsInside.accuracy = coordsInside.accuracy.toString();
            }
            triggerEvent(typeFetch, coordsInside);
          });
        }, timeToWaitForSecond);
        return;
      }
      coords.accuracy = coords.accuracy.toString();
    }
    triggerEvent(typeFetch, coords);
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
  fetchLocation('client-start');

  getCurrentTime((res, error) => {
    if (error) { return; }
    const dateTime = `${res.dateTime}Z`;
    const dataToUpdate = { externalDateTime: dateTime, localDateTime: new Date().toISOString() };
    writeStorage(dataToUpdate.externalDateTime, dataToUpdate.localDateTime, (res, _err) => {
      if (!res) return;
      fetchLocation('force', (err) => {
        if (err) return;
        storeForceData('update', {type: 'keys', id: 'last_force_datetime', columns: ['value'], values: [dataToUpdate]}, (err) => {
          if (err) return cb(null, new Error("Unable to update db  keys last force location values"));
          logger.info('Updated db keys last force location values');
        });
      });
    });
  });
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
