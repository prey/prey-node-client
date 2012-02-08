//////////////////////////////////////////
// Prey JS Geo Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		client = require('needle'),
		Provider = require('../../provider'),
		Network = require('../network');

var Geo = function(){

	Provider.call(this);
	var self = this;
	// this.name = 'geo';

	this.getters = [
		'location'
	];

	this.get_location = function(){

		Network.get('access_points_list', function(aps_list){

			// var aps_list = [{signal_strength : 9, mac_address : "00-24-6c-a9-01-51", age: 0}];

			if(!aps_list){
				self.emit('location', false, "No access points list, cannot get geolocation.");
				return false;
			}

			var data = {
				version: '1.1.0',
				host: 'maps.google.com',
				request_address: true,
				wifi_towers: aps_list
			}

			client.post("https://www.google.com/loc/json", 
				JSON.stringify(data), 
				{headers: {'Content-Type' : 'application/json'}}, 
				function(err, response, body){
	
				if(body instanceof String){

					try {
						var coords = JSON.parse(body);
					} catch(e) {
						return self.emit('location', false, e.code);
					}

				} else {

					var coords = body;

				}

				if(coords.location && coords.location.latitude){

					coords_data = {
						lat: coords.location.latitude,
						lng: coords.location.longitude,
						accuracy: coords.location.accuracy
					}

					self.emit('location', coords_data);

				} else {

					self.emit('location', null, "Couldn't get any location data. Try moving around a bit.");

				}

			});

		});

	}

};


util.inherits(Geo, Provider);
module.exports = new Geo();
