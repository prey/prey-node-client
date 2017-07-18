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

var util        = require('util'),
    Emitter     = require('events').EventEmitter,
    os_name     = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    network     = require('./../../providers/network/' + os_name),
    logger      = require('./../../common').logger.prefix('geofencing'),
    geo         = require('./../../providers/geo'),
    LatLon      = require('./lib/latlng'),
    storage     = require('./../../actions/geofencing/storage'),
    device_keys = require('./../../utils/keys-storage');

var check_ap_mac,
    current_mac,
    fences = {},
    last_location = {lat: 0.0, lng: 0.0, accuracy: 0, method: null};

var checkLocation = function(cb) {
  function get_location() {
    geo.get_location(function(err, coords) {
      if (err || coords.method != 'wifi') {
        return cb(new Error("There was a problem verifying location"))
      } else {
        last_location = coords;
        return cb(null);
      }
    });
  }
  get_location();
}

var GeofenceTrigger = function(options) {

  var self = this;

  Object.keys(options).forEach(function(k) {
    self[k] = options[k];
  });

  // Setup default values
  this.radius = this.radius || 1000 * 1; // one kilometer
  this.interval = this.interval || 1000 * 60 * 60 * 1; // one hour

  this.getDistance = function(latlng1, latlng2) {
    var p1 = new LatLon(latlng1.lat, latlng1.lng);
    var p2 = new LatLon(latlng2.lat, latlng2.lng);
    return p1.distanceTo(p2);
  };

  this.start = function(callback) {
    var origin = {lat: self.lat, lng: self.lng};

    function check_geozones() {
      if (last_location) {
        logger.debug('Verifying geofence: ' + self.id + ', Radius: ' + self.radius);
        logger.debug("Current location: " + last_location.lat + "," + last_location.lng);

        // in case an origin wasnt passed, set the first location as the origin
        //if (!this.origin) return this.origin = { coords;
        var distance = self.getDistance(origin, last_location);

        logger.debug("Current distance from origin: " + distance);
        // distance comes in KM, so we transform to M to compare
        if (last_location.method && last_location.method == 'wifi' && last_location.accuracy < 300) {
          if (distance * 1000 > self.radius) { // outside

            storage.update(self.id, self.name, self.state, 'outside', function(err) {
              if (err) logger.error(err);
              else {
                if (self.state == 'inside' && self.direction !== 'in') {
                  logger.info('Device left the geofence ' + self.name + '! Notifying')
                  self.emit('left_geofence', last_location);
                }

                self.state = 'outside';
              }
            });

          } else { // inside

            storage.update(self.id, self.name, self.state, 'inside', function(err) {
              if (err) logger.error(err);
              else {
                if ((self.state == 'outside' && self.direction !== 'out') || self.state == null) {
                  logger.info('Device got inside the geofence ' + self.name + '! Notifying')
                  self.emit('entered_geofence', last_location);
                }

                self.state = 'inside';
              }
            });

          }
        } 
      } 
    }

    callback(null, self);
    check_geozones(); // trigger immediately, then interval
  };

  this.stop = function(err) {
    // self.emit('end', err);
    self.removeAllListeners();
  };

};

var MacCheckTrigger = function() {
  var self = this;
  var loop;
  var interval = 1000 * 60 * 3; // Check every 3 minutes

  this.start = function(cb) {
    function compare_mac() {
      network.get_active_access_point_mac(function(err, out) {
        if (err || !out) return cb(new Error('Unable to get the active access point mac address'));
        current_mac = out.includes('\n') ? out.split("\n").slice(0, -1)[0] : out;

        if (!current_mac || current_mac == '')
          return cb(new Error('Invalid mac address'));
      
        device_keys.get_stored('mac', function(err, stored_mac) {
          if (err) return cb(err);
          if (!stored_mac) {
            checkLocation(function(err) {
              if (err) return cb(err);
              device_keys.store('mac', current_mac, function(err) {
                if (err) return cb(err);
                cb(null, true);
              })
            })
          } else {
            if (current_mac == stored_mac) {
              return cb(null, false);  // Do nothing
            } else {
              checkLocation(function(err, coords) {
                if (err) return cb(err);
                device_keys.update('mac', stored_mac, current_mac, function(err) {
                  if (err) return cb(err);
                  cb(null, true);
                })
              })
            }
          }
        })
      })
    }
    compare_mac();
    loop = setInterval(compare_mac, interval);
  }

  this.stop = function(err) {
    clearInterval(loop);
    self.removeAllListeners();
  }
}

util.inherits(MacCheckTrigger, Emitter);
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

  if (check_ap_mac) {
    check_ap_mac.stop();
  }

  check_ap_mac = new MacCheckTrigger();
  check_ap_mac.start(function(err, run) {
    if (err) logger.error(err.message);
    
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

      if (fences[location.id]) {
        fences[location.id].stop();
      }

      fences[location.id] = new GeofenceTrigger(opts);
      if (!err && run) fences[location.id].start(callback);
      else return callback(null, fences[location.id]);
    });
  });
};

function stop(cb) {
  // Called when geofence action receives empty array of geofences.
  if (check_ap_mac) check_ap_mac.stop();

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