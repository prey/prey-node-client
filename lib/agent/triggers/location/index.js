var join          = require('path').join,
    base_path     = join(__dirname, '..', '..'),
    hooks         = require(join(base_path, 'hooks')),
    LatLon        = require('./lib/latlng'),
    devices       = require('./../../control-panel/api/devices'),
    geo           = require('./../../providers/geo'),
    //control_panel = require('./../../../agent/control-panel'),
    control_panel = require('../../control-panel'),
    logger        = require('./../../common').logger.prefix('location'),
    Emitter       = require('events').EventEmitter;

var emitter,
    loc_callbacks = [],
    current   = {},
    checking  = false,
    aware_log = 'New location obtained! Making the Control Panel aware...',
    last_sent_time;

var post_it = (data) => {
  if (!data || Object.keys(data).length == 0) return;

  logger.info(aware_log);
  devices.post_location(data, (err, state) => {
    if (err) return logger.error('Unable to notify location: ' + err.message);

    if (state != null && state != control_panel.get_setting('location_aware')) {
      control_panel.update_setting('location_aware', state);    // Update location setting
    }
    return;
  });
}

var send_location = (type, location) => {
  if (type == 'control-panel') return;
  last_sent_time = Date.now();
  var data = {};

  data.location = location;

  logger.info(JSON.stringify(control_panel))
  if (control_panel.get_setting('location_aware'))
    return post_it(data);

  devices.get.status((err, resp) => {
    var result = resp && resp.body;

    if (err || !result || (resp && resp.statusCode > 300))
      return logger.warn('Unable to sync location aware.');

    var aware = result.settings.local.location_aware;
    if (!aware) return;
    return post_it(data);
  });
}

var fetch_location = (type, callback) => {
  if (callback) loc_callbacks.push(callback);
  if (checking) return;

  var done = (err, coords) => {
    if (loc_callbacks.length >= 1) {
      fire_callbacks(err, coords);
    }
    loc_callbacks = [];
    checking = false;
  }

  var fire_callbacks = (err, coords) => {
    var list = loc_callbacks;
    list.forEach((fn) => {
      fn(err, coords);
    });
  }

  var trigger_event = (type, new_location) => {
    var event = 'new_location';

    if (Object.keys(current).length == 0 || type == 'interval') {   // There isn't a previous location or we're forcing it
      current = new_location;
      exports.current = new_location;
      done(null, current);
      send_location(type, new_location);
      return hooks.trigger(event, new_location);
    }

    var p1 = new LatLon(current.lat, current.lng);
    var p2 = new LatLon(new_location.lat, new_location.lng);
    var distance = p1.distanceTo(p2) * 1000;  // in meters

    new_location.delta = distance;

    var better_loc = () => {
      var is_better = false;
      if (!current.accuracy && !!new_location.accuracy)
        is_better = true;
      else if (!!current.accuracy && !!new_location.accuracy && new_location.accuracy < current.accuracy)
        is_better = true;
      return is_better;
    }

    if (distance >= 30 || (distance < 30 && better_loc())) {
      current = new_location;
      exports.current = new_location;
      send_location(type, new_location);
    }

    done(null, current);
    hooks.trigger(event, new_location);
  }

  checking = true;
  geo.fetch_location((err, coords) => {
    if (err || !coords || !emitter)
      return done(new Error('Unable to get location'));

    coords.lng = coords.lng.toString();
    coords.lat = coords.lat.toString();
    if (coords.accuracy) coords.accuracy = coords.accuracy.toString();

    trigger_event(type, coords);
  });
}

exports.start = (opts, cb) => {
  hooks.on('mac_address_changed', () => {
    fetch_location('mac-address');
  });

  hooks.on('get_location', (callback) => {
    if (typeof(callback) == 'function')
      fetch_location('control-panel', callback);
    else fetch_location(callback);
  });

  fetch_location('client-start');

  setInterval(() => {
    if (last_sent_time) {
      var time_between =  1000 * 60 * 60 * 24,     // new location at least every 24 hours
          date_now = Date.now();
  
      if (date_now - last_sent_time > time_between)
        fetch_location('interval');
    }
    else fetch_location('interval');
  }, 1000 * 60 * 60);  // Check every hour

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
