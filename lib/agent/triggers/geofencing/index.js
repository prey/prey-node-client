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
//      center: '-33.4230905, -70.6138094',
//      radius: 100,
//      type: 'in',
//      expires: -1
//    }]
//  }
//
//////////////////////////////////////////

var util    = require('util'),
    Emitter = require('events').EventEmitter,
    logger  = require('./../../common').logger.prefix('geofencing'),
    geo     = require('./../../providers/geo'),
    LatLon  = require('./lib/latlng');

var fences = {};

var GeofenceTrigger = function(options) {

  var self = this;

  this.id = options.id;
  this.origin   = options.origin;
  this.radius   = options.radius || 1000 * 1; // in meters, default 1000
  this.interval = options.interval || 1000 * 15 * 1; // every one minute

  this.getDistance = function(latlng1, latlng2) {
    var p1 = new LatLon(latlng1.lat, latlng1.lng);
    var p2 = new LatLon(latlng2.lat, latlng2.lng);
    return p1.distanceTo(p2);
  };

  this.start = function(callback) {

    var last_coords, inside_geofence;

    this.loop = setInterval(function() {

      geo.get_location(function(err, coords) {

        logger.debug('Verifying geofence: ' + self.id);

        if(err) {
          logger.debug('There was a problem verifying geofence ' + self.id + ': ' + err);
          return self.stop(err);
        }

        logger.debug("Current location: " + coords.lat + "," + coords.lng);

        if (coords === last_coords)
          return logger.info("Location hasn't changed.");

        // in case an origin wasnt passed, set the first location as the origin
        //if (!this.origin) return this.origin = { coords;

        var distance = self.getDistance(self.origin, coords);
        logger.debug("Current distance from origin: " + distance);

        // distance comes in KM, so we transform to M to compare
        if (distance * 1000 > self.radius) { // outside

          if (inside_geofence)
            self.emit('left_geofence', coords);
          inside_geofence = false;

        } else { // inside

          if (inside_geofence === false)
            self.emit('entered_geofence', coords);
          inside_geofence = true;

        }

        last_coords = coords;

      });

    }, this.interval);

    callback(null, self);

  };

  this.stop = function(err) {
    clearInterval(this.loop);
    // self.emit('end', err);
    self.removeAllListeners();
  };

};

util.inherits(GeofenceTrigger, Emitter);

/////////////////////////////

exports.start = function(options, callback) {

  if (!options.locations) {
    // trigger error
  }

  options.locations.forEach(function (location) {

    var opts = {};

    if(fences[location.id]) {
      fences[location.id].stop();
    }

    opts.origin = parse_coords(location.center);
    opts.id = location.id;

    fences[location.id] = new GeofenceTrigger(opts);
    fences[location.id].start(callback);
  });

  function parse_coords(coords) {
    var parsed_coords = [],
        coords_obj = {};

    var parsed_coords = coords.replace(' ', '').split(',').map(function(axis) {
      return parseFloat(axis);
    });

   coords_obj.lat = parsed_coords[0];
   coords_obj.lng = parsed_coords[1];

   return coords_obj;
  }

  //this.fence = new GeofenceTrigger(options);
  //this.fence.start(callback);
};

exports.stop = function() {
  if (this.fence) {
    this.fence.stop();
    this.fence = null;
  }
};

exports.events = ['entered_geofence', 'left_geofence'];
