var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    LatLon    = require('./lib/latlng'),
    geo       = require('./../../providers/geo'),
    Emitter   = require('events').EventEmitter;

var emitter,
    loc_callback,
    current   = {},
    checking  = false;

var trigger_event = function(type, new_location) {
  var event = 'new_location';
  
  if (Object.keys(current).length == 0) {
    current = new_location;

    return emitter.emit(event, new_location);
  }

  var p1 = new LatLon(current.lat, current.lng);
  var p2 = new LatLon(new_location.lat, new_location.lng);
  var distance = p1.distanceTo(p2) * 1000;  // in meters

  new_location.delta = distance;
  current = new_location;

  emitter.emit(event, new_location);
}

var fetch_location = function(type, callback) {
  if (callback) loc_callback = callback;
  if (checking) return;

  var done = function(err, coords) {
    if (!err && loc_callback) {
      loc_callback(null, coords);
    }
    loc_callback = null;
    checking = false;
  }

  checking = true;
  geo.fetch_location(function(err, coords) {
    if (err || !coords || !emitter) return done(err);

    done(null, coords);
    trigger_event(type, coords);

  });
}

exports.start = function(opts, cb) {

  hooks.on('mac_address_changed', function() {
    fetch_location('mac-address');
  });

  hooks.on('get_location', function(callback) {
    if (typeof(callback) == 'function')
      fetch_location('control-panel', callback);
    else fetch_location(callback);
  });
  
  fetch_location('client-start');

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

exports.events = [ 'new_location' ];
