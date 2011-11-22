//////////////////////////////////////////
// Prey Setup Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		sys = require('sys'),
		fs = require('fs'),
		http_client = require('restler'),
		stringify = require('qs').stringify,
		Response = require('./response_parser');

var config_file_path = base.root_path + '/config.js'

var Setup = {

	store_config_value: function(key_name, value){
		var pattern = new RegExp("\t+" + key_name + ":.*");
		var new_value = "\t" + key_name + ': "' + value + '",';
		base.helpers.replace_in_file(config_file_path, pattern, new_value);
	},

	auto_register: function(options, callback){

		var self = this;
		var url = options.check_url + '/devices.xml';

		var http_options = {
			username: options.api_key,
			password: "x",
			headers : { "User-Agent": options.user_agent }
		}

		var data = {
			device: {
				title: 'My device',
				device_type: 'Portable',
				os: 'Ubuntu',
				os_version: '11.04'
			}
		}

		http_options.data = stringify(data);
		http_options.headers['Content-Length'] = options.data.length; // damn restler module

		http_client.post(url, http_options)
		.on('error', function(body, response){
			log("Response body: " + body);
		})
		.on('complete', function(body, response){

			debug("Response body: " + body);
			log(' -- Got status code: ' + response.statusCode);

			if(response.statusCode == 201){

				log(" -- Device succesfully created.");
				Response.parse_xml(body, function(result){

					if(result.key){

						log(" -- Got device key: " + result.key + ". Storing in configuration...")
						config.device_key = result.key;

						self.store_config_value('device_key', result.key);
						callback(result.key)

					} else {

						quit("No device key found! Cannot continue.")

					}

				})

			}
		})

	}

}

module.exports = Setup;
