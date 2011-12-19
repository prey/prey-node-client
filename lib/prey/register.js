//////////////////////////////////////////
// Prey Register Module
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		logger = common.logger,
		fs = require('fs'),
		http_client = require('needle');

var Register = {

	store_config_value: function(key_name, value, callback){
		var pattern = new RegExp("\t+" + key_name + ":.*");
		var new_value = "\t" + key_name + ': "' + value + '",';
		common.helpers.replace_in_file(common.config_file, pattern, new_value, callback);
	},

	profile: function(options, callback){

		var url = common.constants.profile_url;
		options.headers = {'User-Agent': common.user_agent};

		http_client.get(url, options, function(err, response, body){

			if(err) return callback(false);

			console.log("Got status code: " + response.statusCode);

			if(response.statusCode != 200){

				console.error(body);
				callback(false);

			} else if(parseInt(body.available_slots) <= 0){

				console.warn("You've reached the limit! No available slots left. Time to upgrade?");
				callback(false);

			} else if(body.key) {

				Register.store_config_value('api_key', body.key, function(err){
					callback(!err);
				});

			} else {

				console.error("Don't know what happened there. Try again later!");
				callback(false);

			}

		});

	},

	user: function(data, callback){

		var url = common.constants.signup_url;
		var headers = {'User-Agent': common.user_agent};

		http_client.post(url, data, {headers: headers}, function(err, response, body){

			if(err) return callback(false);

			if(response.statusCode == 201 && body.key)
				Register.store_config_value('api_key', body.key, function(err){
					callback(!err);
				});
			else
				callback(false);

		});

	},

	device: function(options, callback){

		var url = common.constants.new_device_url;

		var request_opts = {
			username: options.api_key,
			password: 'x',
			headers: { 'User-Agent': common.user_agent }
		}

		Register.get_device_data(function(data){

			http_client.post(url, {device: data}, request_opts, function(err, response, body){

				if (err) {

					logger.error("Error on request. Please try again in minute.");
					callback(false);

				} else if(response.statusCode != 201){

					logger.error("Seems you ran out of slots. Support Prey by upgrading to Pro!");
					callback(false);

				} else {

					logger.info("Device succesfully created.");
					var device_key = body.key;

					if(device_key){

						logger.info("Got device key: " + device_key + ". Storing in configuration...")

						Register.store_config_value('device_key', device_key, function(err){
							if(err) {
								logger.error("Couldn't save to config file. Cannot continue.");
								return callback(false);
							}
							callback(device_key)
						});

					} else {

						logger.error("No device key found! Cannot continue.");
						callback(false);

					}

				}

			});

		});

	},

	get_device_data: function(callback){

		var Hardware = require('./providers/hardware');
				System = require('./providers/system');
				data = {};

		var callback_if_ready = function(){
			// console.log(data);
			if(Object.keys(data).length < 6) return;
			callback(data);
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
