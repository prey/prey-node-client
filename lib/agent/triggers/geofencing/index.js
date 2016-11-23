"use strict";

//////////////////////////////////////////
// Prey Geofencing Plugin
// (c) 2012 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
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

var util    = require('util'),
    Emitter = require('events').EventEmitter,
    logger  = require('./../../common').logger.prefix('geofencing'),
    geo     = require('./../../providers/geo'),
    LatLon  = require('./lib/latlng'),
    storage = require('./../../actions/geofencing/storage');

var fences = {};

var location;
var last_location = {lat: 0.0, lng: 0.0, accuracy: 0, method: null};

var LocationTrigger = function() {
  var self = this;
  this.interval = this.interval || 1000 * 60 * 1; // one minute
  
  this.start = function(callback) {
    function get_location() {
      geo.get_location(function(err, coords) {
        if (err) {
          logger.error('There was a problem verifying location');
          return callback();
        }
        last_location = coords;
        callback();
      });
    }

    function iterate_location() {
      geo.get_location(function(err, coords) {
        if (err) {
          logger.error('There was a problem verifying location');
        }
        last_location = coords;
      });
    }

    get_location();
    this.loop = setInterval(iterate_location, this.interval);

  }
  this.stop = function(err) {
    clearInterval(this.loop);
    self.removeAllListeners();
  }
}

var GeofenceTrigger = function(options) {

  var self = this;

  Object.keys(options).forEach(function(k) {
    self[k] = options[k];
  });

  // Setup default values
  this.radius = this.radius || 1000 * 1; // one kilometer
  this.interval = this.interval || 1000 * 60 * 1; // one minute

  this.getDistance = function(latlng1, latlng2) {
    var p1 = new LatLon(latlng1.lat, latlng1.lng);
    var p2 = new LatLon(latlng2.lat, latlng2.lng);
    return p1.distanceTo(p2);
  };

  this.start = function(callback) {
    var origin = {lat: self.lat, lng: self.lng};

    function check_location() {
      if (last_location) {
        logger.debug('Verifying geofence: ' + self.id + ', Radius: ' + self.radius);
        logger.debug("Current location: " + last_location.lat + "," + last_location.lng);
        logger.debug("Accuracy: " + last_location.accuracy + ", Method: " + last_location.method);

        // in case an origin wasnt passed, set the first location as the origin
        //if (!this.origin) return this.origin = { coords;
        var distance = self.getDistance(origin, last_location);

        logger.debug("Current distance from origin: " + distance);
        // distance comes in KM, so we transform to M to compare
        if (last_location.method) {
          if (distance * 1000 > self.radius) { // outside

            storage.update(self.id, self.name, self.state, 'outside', function(err) {
              if (err) logger.error(err);
            });

            if (self.state == 'inside' && self.direction !== 'in') {
              logger.debug('Device left the geofence! Notifying')
              self.emit('left_geofence', last_location);
            }

            self.state = 'outside';
            
          } else { // inside

            storage.update(self.id, self.name, self.state, 'inside', function(err) {
              if (err) logger.error(err);
            });

            if ((self.state == 'outside' && self.direction !== 'out') || self.state == null) {
              logger.debug('Device got inside the geofence! Notifying')
              self.emit('entered_geofence', last_location);
            }

            self.state = 'inside';
          }
        } 
      } 
    }

    callback(null, self);
    check_location(); // trigger immediately, then interval
    this.loop = setInterval(check_location, this.interval);

  };

  this.stop = function(err) {
    clearInterval(this.loop);
    // self.emit('end', err);
    self.removeAllListeners();
  };

};

util.inherits(LocationTrigger, Emitter);
util.inherits(GeofenceTrigger, Emitter);

/////////////////////////////

function start(locations, callback) {
  if (!locations) {
    // trigger error
    return callback(new Error('Cannot initialize geofencing: No locations handled.'));
  }

  // Stop all fences before re-adding them
  // TODO @lemavri stop only fences missing from options.location that are already running
  stop();

  if (location) {
    location.stop();
  }

  location = new LocationTrigger();
  location.start(function() {

    locations.forEach(function (location) {
      var opts = {
        id: location.id,
        name: location.name,
        lat: location.lat,
        lng: location.lng,
        direction: location.direction,
        radius: location.radius,
        expires: location.expires,
        state: location.state
      };

      if(fences[location.id]) {
        fences[location.id].stop();
      }

      fences[location.id] = new GeofenceTrigger(opts);
      fences[location.id].start(callback);
    });
  });
};

function stop(cb) {
  // Called when geofence action receives empty array of geofences.
  if (location) location.stop();

  if (Object.keys(fences).length) {
    Object.keys(fences).forEach(function(k) {
      fences[k].stop();
      delete fences[k];
    });
    fences = {};
  }
  cb && cb();
};

exports.start = start;
exports.stop = stop;

exports.events = ['entered_geofence', 'left_geofence'];