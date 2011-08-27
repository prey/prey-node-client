//////////////////////////////////////////
// Prey Setup Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		fs = require('fs'),
		helpers = require('./helpers'),
		http_client = require('http_client'),
		Response = require('./response_parser');

var config_file_path = base_path + '/config'

var Setup = {

	store_config_value: function(key_name, value){
		var pattern = new RegExp("\t" + key_name + ":.*");
		var new_value = "\t" + key_name + ': "' + value + '",';
		this.replace_in_file(config_file_path, pattern, new_value);
	},

	replace_in_file: function(file_name, from, to){

		fs.readFile(file_name, function (err, data) {
			if (err) throw err;
			var new_data = data.toString().replace(from, to);
			if(new_data != data) save_file_contents(file_name, new_data)
		});
	},

	auto_register: function(callback){

		var url = config.check_url + '/devices.xml';

		var options = {
			user: config.api_key,
			pass: "x",
			headers : { "User-Agent": self.user_agent }
		}

		var data = {
			device: {
				title: 'My device',
				device_type: 'Portable',
				os: 'Ubuntu',
				os_version: '11.04'
			}
		}

		http_client.post(url, data, options, function(response, body){

			debug("Response body: " + body);
			log(' -- Got status code: ' + response.statusCode);

			if(response.statusCode == 201){

				log(" -- Device succesfully created.");
				Response.parse_xml(body, function(result){

					if(result.key){

						log(" -- Got device key: " + result.key + ". Storing in configuration...")
						config.device_key = result.key;

						Setup.store_config_value('device_key', result.key);
						callback()

					} else {

						quit("No device key found! Cannot continue.")

					}

				})

			}
		})

	}

}

module.exports = Setup;
