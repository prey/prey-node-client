//////////////////////////////////////////
// Prey JS Geo Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../base'),
		util = require('util'),
		http_client = require('restler'),
		InfoModule = require('../info_module'),
		Network = require('../network');

var Geo = function(){

	InfoModule.call(this);
	var self = this;
	this.name = 'geo';

	// overrides PreyModule's base run() method
	this.start = function(){

		this.get('coords_via_wifi', function(coords){
			self.emit('trace', 'lat', coords.lat);
			self.emit('trace', 'lng', coords.lng);
			self.emit('trace', 'accuracy', coords.accuracy);
			self.done();
		});

	}

	this.get_coords_via_wifi = function(){

		Network.get('access_points_list', function(aps_list){

			// var aps_list = [{signal_strength : -57, mac_address : "00-24-6c-a9-01-51"}];

			if(!aps_list){
				self.emit('coords_via_wifi', false, "No access points list, cannot get geolocation.");
				return false;
			}

			var data = {
				version: '1.1.0',
				host: 'maps.google.com',
				request_address: true,
				wifi_towers: aps_list
			}

			var options = {
				headers: {
					'Content-Type' : 'application/json'
				},
				data: JSON.stringify(data)
			}

			http_client.post("http://www.google.com/loc/json", options).on('complete', function(json_response, response){

				if(json_response instanceof String){

					try {

						var coords = JSON.parse(json_response);

					} catch(e) {

						self.emit('coords_via_wifi', false, e.code);
						return false;

					}

				} else {

					var coords = json_response;

				}

				if(coords.location.latitude){

					log(" -- Got location data!");

					coords_data = {
						lat: coords.location.latitude,
						lng: coords.location.longitude,
						accuracy: coords.location.accuracy
					}

					self.emit('coords_via_wifi', coords_data);

				} else {

					self.emit('coords_via_wifi', false, "Couldn't get any location data. Try moving around a bit.");

				}

			});

		});

	}

};


util.inherits(Geo, InfoModule);
module.exports = new Geo();
