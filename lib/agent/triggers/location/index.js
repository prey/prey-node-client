var triggers  = require('triggers'),
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    LatLon    = require('./lib/latlng'),
    geo       = require('./../../providers/geo'),
    Emitter   = require('events').EventEmitter;

var emitter,
    loc_callback,
    current   = {},
    checking  = false;

// var post_location = function(data) {
//   if (!loc_callback && data.accuracy < 100 && (!data.delta || data.delta > 0))
//     console.log("POST LOCATION!!!:", data)
//     // hooks.trigger('data', 'location', data);
//   return;
// }

var trigger_event = function(new_location) {
  var event = 'new_location';
  
  if (Object.keys(current).length == 0) {
    current = new_location;

    // post_location(new_location);
    return emitter.emit(event, new_location);
  }

  var p1 = new LatLon(current.lat, current.lng);
  var p2 = new LatLon(new_location.lat, new_location.lng);
  var distance = p1.distanceTo(p2) * 1000;     // in meters

  new_location.delta = distance;
  current = new_location;

  // post_location(new_location);
  emitter.emit(event, new_location);
}

var fetch_location = function(callback) {
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
  geo.get_location(function(err, coords) {
    if (err || !coords || !emitter) return done(err);

    trigger_event(coords);
    done(null, coords);
  });
}

exports.start = function(opts, cb) {

  hooks.on('mac_address_changed', function() {
    fetch_location();
  });

  hooks.on('get_location', function(callback) {
    fetch_location(callback);
  });
  
  fetch_location();

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
