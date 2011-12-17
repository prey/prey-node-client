//////////////////////////////////////////
// Prey Register Module
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		config = common.config,
		logger = common.logger,
		fs = require('fs'),
		http_client = require('needle');

var config_file_path = common.root_path + '/config.js';

var Register = {

	store_config_value: function(key_name, value, callback){
		var pattern = new RegExp("\t+" + key_name + ":.*");
		var new_value = "\t" + key_name + ': "' + value + '",';
		common.helpers.replace_in_file(config_file_path, pattern, new_value, callback);
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

		var url = common.constants.new_user_url;
		var headers = {'User-Agent': common.user_agent};

		http_client.post(url, data, {headers: headers}, function(err, response, body){

			if(err) return callback(false);

			if(response.statusCode == 201 && body.key)
				Register.store_config_value('api_key', body.key, callback);
			else
				callback(false);

		});

	},

	device: function(options, callback){

		var url = common.constants.new_device_url;

		var options = {
			username: config.api_key,
			password: 'x',
			headers: { 'User-Agent': common.user_agent }
		}

		Register.get_device_data(function(data){

			http_client.post(url, data, options, function(err, response, body){

				if(response.statusCode == 201){

					logger.info("Device succesfully created.");
					var device_key = body.key;

					if(device_key){

						logger.info("Got device key: " + device_key + ". Storing in configuration...")
						config.device_key = device_key;

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

				} else {

					logger.error("Couldn't create device. Perhaps you ran out of slots?");
					callback(false);

				}

			});

		});

	},

	get_device_data: function(callback){

		var Hardware = require('./providers/hardware');
				System = require('./providers/system');
				data = {};

		var check_if_ready = function(){
			if(Object.keys(data) < 4) return;
			// console.log(data);
			callback(data);
		}

		Hardware.get('firmware_info', function(data){
			data.title = data.hardware_product,
			data.device_type = data.formfactor == 'laptop' ? 'Laptop' : 'Desktop';
			callback_if_ready();
		});

		System.get('os_name', function(os_name){
			data.os_name = os_name;
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
