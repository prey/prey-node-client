//////////////////////////////////////////
// Prey Setup Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		logger = common.logger,
		fs = require('fs'),
		http_client = require('restler'),
		stringify = require('qs').stringify,
		Response = require('./response_parser'),
		System = require('./providers/system');

var config_file_path = common.root_path + '/config.js'

var Setup = {

	store_config_value: function(key_name, value){
		var pattern = new RegExp("\t+" + key_name + ":.*");
		var new_value = "\t" + key_name + ': "' + value + '",';
		common.helpers.replace_in_file(config_file_path, pattern, new_value);
	},

	auto_register: function(options, callback){

		var self = this;
		var url = options.check_url + '/devices.xml';

		var http_options = {
			username: options.api_key,
			password: "x",
			headers : { "User-Agent": options.user_agent }
		}

		this.get_system_data(function(data){

			self.send_request(url, data, http_options);

		});

	},

	get_system_data: function(callback){

		var data = {
			device: {
				title: 'My device',
				device_type: 'Portable',
				os: 'Ubuntu',
				os_version: '11.04'
			}
		}

		callback(data);

	},

	send_request: function(url, data, options){

		options.data = stringify(data);

		http_client.post(url, options)
		.on('error', function(body, response){

			logger.info("Response body: " + body);

		})
		.on('complete', function(body, response){

			// logger.debug("Response body: " + body);
			logger.info(' -- Got status code: ' + response.statusCode);

			if(response.statusCode == 201){

				logger.info(" -- Device succesfully created.");
				Response.parse_xml(body, function(result){

					if(result.key){

						logger.info(" -- Got device key: " + result.key + ". Storing in configuration...")
						config.device_key = result.key;

						self.store_config_value('device_key', result.key);
						callback(result.key)

					} else {

						throw("No device key found! Cannot continue.");

					}

				})

			}
		})

	}

}

module.exports = Setup;
