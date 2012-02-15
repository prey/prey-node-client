//////////////////////////////////////////
// Prey Register Module
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		logger = common.logger,
		path = require('path'),
		fs = require('fs'),
		http_client = require('needle');

var driver_config_file = path.join(common.config_path, 'drivers', 'control_panel.js');

var request_format = '.xml';
var profile_url = 'https://control.preyproject.com/profile' + request_format;
var signup_url = 'https://control.preyproject.com/register' + request_format;
var new_device_url = 'https://control.preyproject.com/devices' + request_format;

var Register = {

	profile: function(options, callback){

		var url = profile_url;
		options.headers = {'User-Agent': common.user_agent};

		http_client.get(url, options, function(err, response, body){

			if(err) return callback(err);
			
			console.log("Got status code: " + response.statusCode);

			if(response.statusCode != 200){

				console.error(body);
				callback(new Error("Unexpected status code: " + response.statusCode));

			} else if(parseInt(body.available_slots) <= 0){

				console.warn("You've reached the limit! No available slots left. Time to upgrade?");
				callback(new Error("No available slots!"));

			} else if(body.key) {
				
				callback(null, {api_key: body.key});

			} else {

				console.error("Don't know what happened there. Try again later!");
				callback(new Error("Unknown error ocurred. Try again later."));

			}

		});

	},

	user: function(data, callback){

		var url = signup_url;
		var headers = {'User-Agent': common.user_agent};

		http_client.post(url, data, {headers: headers}, function(err, response, body){

			if(err) return callback(err);

			if(response.statusCode == 201 && body.key)
				callback(null, {api_key: key})
			else
				callback(new Error("Unknown response."));

		});

	},

	device: function(options, callback){

		var url = new_device_url;

		var request_opts = {
			username: options.api_key,
			password: 'x',
			headers: { 'User-Agent': common.user_agent }
		}

		Register.get_device_data(function(data){
			
			http_client.post(url, {device: data}, request_opts, function(err, response, body){

				if (err) {

					logger.error("Error on request. Please try again in minute.");
					callback(err);

				} else if(body.key){

					logger.info("Device succesfully created. Key: " + body.key);
					callback(null, {device_key: body.key})

				} else if(response.headers['Location']){
					
					logger.error("Seems you ran out of slots. Support Prey by upgrading to Pro!");
					callback(new Error("No device slots left on account."));
				
				} else {
					
					callback(new Error("Unkown response. Could not get device key."));

				}

			});

		});

	},

	get_device_data: function(callback){

		var Hardware = require('./../../providers/hardware');
				System = require('./../../providers/system');
				data = {},
				data_count = 3;

		var callback_if_ready = function(){
			--data_count || callback(data);
		}

		Hardware.get('firmware_info', function(hw_info){
			data.title = hw_info.model_name || "My Computer";
			data.device_type = hw_info.device_type;
			data.vendor_name = hw_info.vendor_name
			data.model_name  = hw_info.model_name;
			callback_if_ready();
		});

		System.get('os_name', function(os_name){
			data.os = os_name;
			callback_if_ready();
		});

		System.get('os_version', function(os_version){
			data.os_version = os_version;
			callback_if_ready();
		});

	}

}

exports.validate = Register.profile;
exports.new_user = Register.user;
exports.new_device = Register.device;