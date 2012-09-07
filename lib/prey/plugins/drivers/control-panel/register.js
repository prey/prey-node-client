//////////////////////////////////////////
// Prey Register Module
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		host = common.config.get('control-panel').host,
		user_agent = common.user_agent,
		http_client = require('needle');

var request_format = '.xml';
var profile_url    = 'https://' + host + '/profile'  + request_format;
var signup_url     = 'https://' + host + '/register' + request_format;
var new_device_url = 'https://' + host + '/devices'  + request_format;

var Register = {

	profile: function(options, callback){

		var url = profile_url;
		options.headers = {'User-Agent': user_agent};

		http_client.get(url, options, function(err, response, body){

			if (err) return callback(err);

			if (response.statusCode != 200){

				callback(new Error("Unexpected status code: " + response.statusCode));

			} else if (body.user && parseInt(body.user.available_slots) <= 0){

				callback(new Error("You've reached the limit! No available slots left."));

			} else if (body.user && body.user.key) {

				callback(null, {api_key: body.user.key});

			} else {

				// console.log(body);
				callback(new Error("Unknown error ocurred. Please try again later."));

			}

		});

	},

	user: function(data, callback){

		var url = signup_url;
		var headers = {'User-Agent': user_agent};

		http_client.post(url, data, {headers: headers}, function(err, response, body){

			if(err) return callback(err);

			if (body && body.key)
				callback(null, {api_key: body.key})
			else
				callback(new Error("Unknown response."));

		});

	},

	device: function(options, callback){

		var url = new_device_url;

		var request_opts = {
			username: options.api_key,
			password: 'x',
			headers: { 'User-Agent': user_agent }
		}

		Register.get_device_data(function(err, data){

			if(err) return callback(err);

			http_client.post(url, {device: data}, request_opts, function(err, response, body){

				if (err) {

					callback(err);

				} else if (body.device && body.device.key){

					callback(null, {device_key: body.device.key});

				} else if (response.statusCode == 302 || response.headers.location){

					callback(new Error("No available slots on account. Support Prey by upgrading to Pro!"));

				} else {

					callback(new Error("Unknown response. Could not get device key."));

				}

			});

		});

	},

	get_device_data: function(callback){

		var Hardware = require('./../../providers/hardware'),
				System = require('./../../providers/system'),
				got_error = false,
				data = {},
				data_count = 3;

		var check_if_ready = function(err){
			if(got_error) return;
			if(err) {
				got_error = true;
				callback(err);
			} else if(!got_error){
				--data_count || callback(null, data);
			}
		}

		Hardware.get('firmware_info', function(err, hw_info){
			if(err) return check_if_ready(err);
			data.title = hw_info.model_name || "My Computer";
			data.device_type = hw_info.device_type;
			data.vendor_name = hw_info.vendor_name
			data.model_name  = hw_info.model_name;
			check_if_ready();
		});

		System.get('os_name', function(err, os_name){
			data.os = os_name;
			check_if_ready();
		});

		System.get('os_version', function(err, os_version){
			data.os_version = os_version;
			check_if_ready();
		});

	}

}

exports.validate = Register.profile;
exports.new_user = Register.user;
exports.new_device = Register.device;
