var Geo = require('./../../lib/prey/providers/geo'),
		LatLon = require('./lib/latlng'),
		emitter = require('events').EventEmitter,
		util = require('util');

var instance;

var Geofence = function(options){
	
	var self = this;

	this.point = options.point;
	this.radius = options.radius || 1000 * 1; // 1 km
	this.interval = options.interval || 1000 * 10; // every ten minutes

	this.getDistance = function(latlng1, latlng2){

		var p1 = new LatLon(latlng1.lat, latlng1.lng);
		var p2 = new LatLon(latlng2.lat, latlng2.lng);
		return p1.distanceTo(p2);

	}

	this.start = function(options, callback){

		var last_coords, inside_geofence;

		this.loop = setInterval(function(){

			Geo.get('location', function(coords){
				
				console.log("Got coords : " + coords.lat + "," + coords.lng);
				
				// in case an origin wasnt pass, set the first location as the origin
				if(!this.point) return this.point = this.coords;

				var distance = self.getDistance(this.point, coords);

				// distance comes in KM
				if (distance * 1000 > this.radius){ // outside

					if(inside_geofence)
						self.emit('left_geofence', coords);
					inside_geofence = false;

				} else { // inside

					if(inside_geofence === false)
						self.emit('entered_geofence', coords);
					inside_geofence = true;

				}

				last_coords = coords;

			});

		}, this.interval);

	}

	this.stop = function(){
		clearInterval(this.loop);
		self.emit('end', true);
	}
	
}

util.inherits(Geofence, emitter);

/////////////////////////////

exports.start = function(options, callback){
	var fence = instance = new Geofence(options || {});
	fence.start();
	callback(fence); // return object so manager waits for 'end' event
}

exports.stop = function(){
	instance.stop();
}

exports.events = ['entered_geofence', 'left_geofence'];