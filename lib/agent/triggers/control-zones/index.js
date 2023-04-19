"use strict";

//////////////////////////////////////////
// Prey Geofencing Plugin
// (c) 2012 - Fork Ltd.
// by Tomas Pollak and Javier Acuña - http://forkhq.com
// GPLv3 Licensed
//
// The geofencing module takes care of notifying the Prey servers
// when the device either gets in or out of a specific geofence.
//
// The command signature is as follows:
//
//  command: 'watch',
//  target: 'geofencing',
//  options: {
//    locations: [{
//      id: 'someId',
//      lat: '-33.4230905',
//      lng: '-70.6138094',
//      radius: 100,
//      direction: 'in'|'out'|'both',
//      expires: -1
//    }]
//  }
//
//////////////////////////////////////////

var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    logger    = require('./../../common').logger.prefix('geofencing'),
    LatLon    = require('./../location/lib/latlng'),
    action    = require('./../../actions/geofencing'),
    storage   = require('./../../utils/storage'),
    api       = require('./../../plugins/control-panel/api'),
    Emitter   = require('events').EventEmitter;

var emitter,
    zones,
    location,
    attempts = 0,
    retryTimeOut,
    checking = false;

let timerActionStart;

var push_event = function(type, zone_id, coords) {
  coords.id = zone_id.id;
  var data = {
    name: type,
    info: coords
  }
  var opts = { json: true };
  api.push['event'](data, opts);
}

var getDistance = function(latlng1, latlng2) {
  var p1 = new LatLon(latlng1.lat, latlng1.lng);
  var p2 = new LatLon(latlng2.lat, latlng2.lng);
  return p1.distanceTo(p2);
}

var fibonacci = function(attempt) {
  if (attempt == 0) return 0;
  else if (attempt == 1) return 1;
  else return (fibonacci(attempt - 1) + fibonacci(attempt - 2));
}

var check_location = function(delay) {
  attempts++;
  retryTimeOut = setTimeout(function() {
    hooks.trigger('get_location', 'geofencing');
  }, delay * 1000 * 60) // Delay in minutes: 0, 1, 1, 2, 3, 5, 8, 13, ....
}

var check_zones = function() {
  if (!location || checking) return;
  checking = true;

  zones.forEach(function (zone) {
    var origin = {lat: zone.lat, lng: zone.lng};

    logger.debug('Verifying geofence: ' + zone.id + ', Radius: ' + zone.radius);
    logger.debug("Current location: " + location.lat + "," + location.lng);

    // in case an origin wasnt passed, set the first location as the origin
    //if (!this.origin) return this.origin = { coords;
    var distance = getDistance(origin, location);

    logger.debug("Current distance from origin: " + distance);
    // distance comes in KM, so we transform to M to compare

    if (distance * 1000 > zone.radius) { // outside
      storage.do('update', { type: 'geofences', id: zone.id, columns: 'state', values: 'outside' }, (err) => {
          if (err) {
            logger.error(err);
            return;
          }
          if (zone.state == 'inside' && zone.direction !== 'in') {
            logger.info('Device left the geofence ' + zone.name + '! Notifying')
            hooks.trigger('geofencing_out', zone.id)
            push_event('geofencing_out', {id: zone.id}, location);
          }
          checking = false;
          zone.state = 'outside';
        });
    } else { // inside
      storage.do('update', { type: 'geofences', id: zone.id, columns: 'state', values: 'inside' }, (err) => {
        if (err) {
          logger.error(err);
          return;
        }
        if ((zone.state == 'outside' && zone.direction !== 'out') || zone.state == null) {
          logger.info('Device got inside the geofence ' + zone.name + '! Notifying')
          hooks.trigger('geofencing_in', zone.id)
          push_event('geofencing_in', {id: zone.id}, location);
        }
        checking = false;
        zone.state = 'inside';
      });
    }
  });
}

exports.start = function(opts, cb) {
  hooks.on('geofencing_start', function(fences) {
    if (!fences) return;

    zones = fences;

    if (!location) return;

    if (zones.length == 0) {
      attempts = 0;
      clearTimeout(retryTimeOut)
      return;
    }

    check_zones();
  });

  hooks.on('new_location', function(coords) {
    // Only check zones on significant location changes
    if (!coords || (coords.delta && coords.delta < 30)) return;

    // When a new trustful location comes it has to be saved, even if there are no fences
    if (coords.method == 'wifi' && coords.accuracy < 300)
      location = coords;

    if (!zones || zones.length == 0) return;

    // If the location isn't trustworthy ask the location again
    if ((coords.method != 'wifi' && coords.method != 'native') || coords.accuracy > 300)
      return check_location(fibonacci(attempts));

    clearTimeout(retryTimeOut)
    attempts = 0;

    check_zones();
  })

  // Fetch geofences and stop previous location check
  hooks.on('connected', function() {
    clearTimeout(retryTimeOut)
    attempts = 0;
    if (timerActionStart) clearTimeout(timerActionStart);
    timerActionStart = setTimeout(() => {
      action.start();
    }, 1000 * 60);
  })

  // No need to keep checking the location until it's connected again
  hooks.on('disconnected', function() {
    if (timerActionStart) clearTimeout(timerActionStart);
    clearTimeout(retryTimeOut)
    attempts = 0;
  })

  emitter = new Emitter();
  cb(null, emitter);

};

exports.stop = function() {
  hooks.remove('geofencing_start');
  hooks.remove('new_location');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};