"use strict";

//////////////////////////////////////////
// Prey Geofencing Plugin
// (c) 2012 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util    = require('util'),
    Emitter = require('events').EventEmitter,
    logger  = require('./../../common').logger,
    geo     = require('./../../providers/geo'),
    LatLon  = require('./lib/latlng');

var GeofenceTrigger = function(options){

  var self = this;

  this.origin   = options.origin;
  this.radius   = options.radius || 1000 * 1; // in meters, default 1000
  this.interval = options.interval || 1000 * 60 * 1; // every one minute

  this.getDistance = function(latlng1, latlng2){
    var p1 = new LatLon(latlng1.lat, latlng1.lng);
    var p2 = new LatLon(latlng2.lat, latlng2.lng);
    return p1.distanceTo(p2);
  };

  this.start = function(callback){

    var last_coords, inside_geofence;

    this.loop = setInterval(function(){

      Geo.get_coordinates(function(err, coords){

        if(err) return self.stop(err);

        logger.debug("Current location: " + coords.lat + "," + coords.lng);

        if (coords === last_coords)
          return logger.info("Location hasn't changed.");

        // in case an origin wasnt passed, set the first location as the origin
        if (!this.origin) return this.origin = coords;

        var distance = self.getDistance(this.origin, coords);
        logger.debug("Current distance from origin: " + distance);

        // distance comes in KM, so we transform to M to compare
        if (distance * 1000 > this.radius){ // outside

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

  this.stop = function(err){
    clearInterval(this.loop);
    // self.emit('end', err);
    self.removeAllListeners();
  };

};

util.inherits(GeofenceTrigger, Emitter);

/////////////////////////////

exports.start = function(options, callback) {
  this.fence = new GeofenceTrigger(options);
  this.fence.start(callback);
};

exports.stop = function() {
  if (this.fence) {
    this.fence.stop();
    this.fence = null;
  }
};

exports.events = ['entered_geofence', 'left_geofence'];
