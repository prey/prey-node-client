var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    devices   = require('./../../plugins/control-panel/api/devices')
    LatLon    = require('./lib/latlng'),
    geo       = require('./../../providers/geo'),
    Emitter   = require('events').EventEmitter;

var emitter,
    loc_callbacks = [],
    current   = {},
    common,
    checking  = false;

var trigger_event = function(type, new_location) {
  var event = 'new_location';
  
  if (Object.keys(current).length == 0) {
    current = new_location;
    send_location(type, new_location);
    return emitter.emit(event, new_location);
  }

  var p1 = new LatLon(current.lat, current.lng);
  var p2 = new LatLon(new_location.lat, new_location.lng);
  var distance = p1.distanceTo(p2) * 1000;  // in meters

  new_location.delta = distance;
  current = new_location;

  // send_location(type, new_location);
  hooks.emit(event, new_location);
}

var send_location = function(type, location) {
  console.log("SEND LOCATION!!!", type, location)
  var data = {};

  if (common.location_updated) {
    data.location = location
  }

  console.log("CURRENT STATE!!:", common.location_updated)
  console.log("DATA:", data)
  devices.post_location(data, function(err, state) {
    if (err) return console.log("ERROR1:", err);
    common.location_updated  = state;  // Update location setting

    console.log("UPDATED SETTING:", common.location_updated, data)

    if (common.location_updated && Object.keys(data).length == 0) {
      data = location;
      console.log("NEW DATA!", data)

      console.log("SECOND POST!:", data)
      devices.post_location(data, function(err) {
        if (err) return console.log("ERROR2:", err);
        data = {};
      });
    } else return;
  })
}

var fetch_location = function(type, callback) {
  if (callback) loc_callbacks.push(callback);
  if (checking) return;

  var done = function(err, coords) {
    if (loc_callbacks.length >= 1) {
      fire_callbacks(err, coords);
    }
    loc_callbacks = [];
    checking = false;
  }

  var fire_callbacks = function(err, coords) {
    var list = loc_callbacks;
    list.forEach(function(fn) {
      fn(err, coords);
    });
  }

  checking = true;
  geo.fetch_location(function(err, coords) {
    console.log("GOT LOCATION!!:", coords)
    if (err || !coords || !emitter)
      return done(new Error('Unable to get location'));

    done(null, coords);
    trigger_event(type, coords);

  });
}

exports.start = function(opts, cb) {
  common = this;
  common.location_updated = false;

  hooks.on('mac_address_changed', function() {
    fetch_location('mac-address');
  });

  hooks.on('get_location', function(callback) {
    if (typeof(callback) == 'function')
      fetch_location('control-panel', callback);
    else fetch_location(callback);
  });
  
  // Give some time to get initial providers before ask for location
  setTimeout(function() {
    fetch_location('client-start');
  }, 3000)

  setInterval(function() {
    fetch_location('iteration');
  }, 20000)

  emitter = new Emitter();
  cb(null, emitter);
};

exports.stop = function() {
  hooks.remove('mac_address_changed');
  hooks.remove('get_location');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [];
