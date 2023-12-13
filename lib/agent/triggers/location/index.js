const { join } = require('path');
const Emitter = require('events').EventEmitter;

const base_path = join(__dirname, '..', '..');
// eslint-disable-next-line import/no-dynamic-require
const hooks = require(join(base_path, 'hooks'));
const LatLon = require('./lib/latlng');
const devices = require('../../control-panel/api/devices');
const geo = require('../../providers/geo');
const controlPanel = require('../../control-panel');

const logger = require('../../common').logger.prefix('location');

let emitter;
let loc_callbacks = [];
let current = {};
let checking = false;
const aware_log = 'New location obtained! Making the Control Panel aware...';
let last_sent_time;

const post_it = (data) => {
  if (!data || Object.keys(data).length === 0) return;

  logger.info(aware_log);
  // eslint-disable-next-line consistent-return
  devices.post_location(data, (err, state) => {
    if (err) return logger.error(`Unable to notify location: ${err?.message}`);

    if (state !== null && state !== controlPanel.get_setting('control-panel.location_aware')) {
      controlPanel.update_setting('control-panel.location_aware', state);
    }
  });
};

const send_location = (type, location) => {
  if (type === 'control-panel') return;
  last_sent_time = Date.now();
  const data = {};

  data.location = location;
  const locationAware = controlPanel.get_setting('control-panel.location_aware');
  if (controlPanel.get_setting('control-panel.location_aware')) return post_it(data);

  devices.get.status((err, resp) => {
    const result = resp?.body;

    if (err || !result || (resp && resp.statusCode > 300)) { return logger.warn('Unable to sync location aware.'); }

    const aware = locationAware;
    if (!aware) return;
    return post_it(data);
  });
};

const fetch_location = (type, callback) => {
  if (callback) loc_callbacks.push(callback);
  if (checking) return;

  const done = (err, coords) => {
    if (loc_callbacks.length >= 1) {
      fire_callbacks(err, coords);
    }
    loc_callbacks = [];
    checking = false;
  };

  var fire_callbacks = (err, coords) => {
    const list = loc_callbacks;
    list.forEach((fn) => {
      fn(err, coords);
    });
  };

  const trigger_event = (type, new_location) => {
    const event = 'new_location';

    if (Object.keys(current).length == 0 || type == 'interval') {
      current = new_location;
      exports.current = new_location;
      done(null, current);
      send_location(type, new_location);
      return hooks.trigger(event, new_location);
    }

    const p1 = new LatLon(current.lat, current.lng);
    const p2 = new LatLon(new_location.lat, new_location.lng);
    const distance = p1.distanceTo(p2) * 1000; // in meters

    new_location.delta = distance;

    const better_loc = () => {
      let is_better = false;
      if (!current.accuracy && !!new_location.accuracy) { is_better = true; } else if (!!current.accuracy && !!new_location.accuracy && new_location.accuracy < current.accuracy) { is_better = true; }
      return is_better;
    };

    if (distance >= 30 || (distance < 30 && better_loc())) {
      current = new_location;
      exports.current = new_location;
      send_location(type, new_location);
    }

    done(null, current);
    hooks.trigger(event, new_location);
  };

  checking = true;
  geo.fetch_location((err, coords) => {
    if (err || !coords || !emitter) { return done(new Error('Unable to get location')); }

    coords.lng = coords.lng.toString();
    coords.lat = coords.lat.toString();
    if (coords.accuracy) coords.accuracy = coords.accuracy.toString();

    trigger_event(type, coords);
  });
};

exports.start = (opts, cb) => {
  hooks.on('mac_address_changed', () => {
    fetch_location('mac-address');
  });

  hooks.on('get_location', (callback) => {
    if (typeof (callback) === 'function') { fetch_location('control-panel', callback); } else fetch_location(callback);
  });

  fetch_location('client-start');

  setInterval(() => {
    if (last_sent_time) {
      const time_between = 1000 * 60 * 60 * 24;
      const date_now = Date.now();

      if (date_now - last_sent_time > time_between) { fetch_location('interval'); }
    } else fetch_location('interval');
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
exports.send_location = send_location;
exports.post_it = post_it;
