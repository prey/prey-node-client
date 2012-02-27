//////////////////////////////////////////
// Prey JS Geo Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		client = require('needle'),
		Provider = require('./../../../provider'),
		Network = require('./../network');

var Geo = function(){

	Provider.call(this);
	var self = this;
	// this.name = 'geo';

	this.getters = [
		'coordinates'
	];

	this.get_coordinates = function(callback){

		Network.get('access_points_list', function(err, aps_list){

			// var aps_list = [{signal_strength : 9, mac_address : "00-24-6c-a9-01-51", age: 0}];

			if(err) return callback(err);

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
						return callback(e);
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

					callback(null, coords_data);

				} else {

					callback(new Error("Couldn't get any geoposition data. Try moving around a bit."));

				}

			});

		});

	}

};


util.inherits(Geo, Provider);
module.exports = new Geo();
