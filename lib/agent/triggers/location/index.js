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
const logger = require('../../common').logger.prefix('location');

let emitter;
let locCallbacks = [];
let current = {};
let checking = false;
let lastSentTime;

const postIt = (data) => {
  if (!data || Object.keys(data).length === 0) return;

  logger.info('New location obtained! Making the Control Panel aware...');
  devices.post_location(data, (err, state) => {
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

const fetchLocation = (typeFetch, callback) => {
  if (callback) locCallbacks.push(callback);
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
    const event = 'newLocation';

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
  geo.fetch_location((err, cords) => {
    const coords = cords;
    if (err || !coords || !emitter) { return done(new Error('Unable to get location')); }

    coords.lng = coords.lng.toString();
    coords.lat = coords.lat.toString();
    if (coords.accuracy) coords.accuracy = coords.accuracy.toString();

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

  fetchLocation('client-start');

  setInterval(() => {
    if (lastSentTime) {
      const timeBetween = 1000 * 60 * 60 * 24;
      const dateNow = Date.now();

      if (dateNow - lastSentTime > timeBetween) { fetchLocation('interval'); }
    } else fetchLocation('interval');
  }, 1000 * 60 * 60);

  emitter = new Emitter();
  cb(null, emitter);
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
