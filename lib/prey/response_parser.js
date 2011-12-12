//////////////////////////////////////////
// Prey Response Parser
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		logger = common.logger,
		Command = require('command'),
		xml2js = require('xml2js'),
		crypto = require('crypto');

var ResponseParser = {

	log: function(str){
		logger.info('[parser] ' + str);
	},

	parse: function(data, options, callback){

		// console.log(data);

		// if we haven't tried to decrypt yet, and it seems encrypted
		if(!options.decrypted && data.indexOf('config') == -1){

			this.decrypt_response(data, options.key, function(output){
				options.decrypted = true;
				// console.log(output);
				ResponseParser.parse(output, options, callback);
			});

		// check if its an xml
		} else if(data.indexOf('<config') != -1){

			this.parse_xml(data, function(result){
				if(result.modules) // old XML
					ResponseParser.build_new_schema(result, callback);
				else
					callback(result);
			});

		// look for application/js(on) or application/javascript
		} else {

			try {
				callback(JSON.parse(data));
			} catch(e){
				this.log("Unkown data type received.");
				callback(false);
			}

		}

	},

	decrypt_response: function(data, key, callback){

		this.log("Got encrypted response. Decrypting...")
		var key = crypto.createHash('md5').update(key).digest("hex");

		// console.log(data);

//		var buf = new Buffer(data, 'base64');
//		var raw = buf.toString('binary');
//
//		var pad = raw.slice(0, 8);
//		var salt = raw.slice(8, 15);
//		var raw = raw.slice(16);

//		console.log(pad);
//		console.log(salt);
//		console.log(raw);

//		var decipher = crypto.createDecipher('aes-128-cbc', key)
//		var dec = decipher.update(raw, 'binary', 'utf8')
//		dec += decipher.final('utf8');

		var cmd_str = 'echo "' + data + '" | openssl aes-128-cbc -d -a -salt -k "' + key +'" 2> /dev/null';
		var cmd = new Command(cmd_str);

		cmd.on('error', function(e){
			throw("OpenSSL returned error when decrypting: " + e.code);
		})

		cmd.on('return', function(output){
			// xml = output.replace(/=([^\s>\/]+)/g, '="$1"'); // insert comments back on node attributes
			// console.log(output)
			callback(output);
		})

	},

	parse_xml: function(data, callback){

		this.log('Parsing XML...')
		var xml_parser = new xml2js.Parser();

		xml_parser.on('end', function(result) {
			callback(result);
		});

		xml_parser.on('error', function(result) {
			throw("Error parsing XML!")
		});

		xml_parser.parseString(data);

	},

	// this function builds a new instruction schema out of the old XML
	build_new_schema: function(original, callback){

		var data = {
			current_release: original.configuration.current_release,
			missing: original.status.missing == 'true',
			delay: parseInt(original.configuration.delay),
			auto_update: original.configuration.auto_update ? true : false,
			offline_actions: original.configuration.offline_actions ? true : false,
			destinations: {}
		}

		var data_types = ['events', 'data', 'report'];

		data_types.forEach(function(data_type){
			data.destinations[data_type] = {
				control_panel: {url: common.device[data_type + '_url'] }
			}
		});

		// events endpoint expects a PUT
		// data.destinations.events.control_panel.method = 'put';

		if(original.configuration.post_url)
			data.destinations.report.control_panel.url = original.configuration.post_url;

		if(original.configuration.on_demand_mode){
			data.on_demand = {
				host: original.configuration.on_demand_host,
				port: parseInt(original.configuration.on_demand_port)
			}
		}

		data.actions = [];
		data.report  = {};

		for(id in original.modules.module){

			var module_data = module_options = original.modules.module[id];
			if(!module_data) continue;

			if(module_data['@']){
				module_data = module_data['@'];
				delete module_options['@'];
			} else {
				module_options = {};
			}

			if(module_data.type == 'report'){

				if(module_data.name == 'webcam'){
					data.report.picture = true;
					continue;
				}

				for(key in module_options){

					var val = module_options[key];
					if(val == 'n' || val == 'false') continue;

					if(/^get_/.test(key)){
						data.report[key.replace('get_', '')] = true;
					} else if (val == 'y' || val == 'true'){
						data.report[key] = true;
					} else { // check if we got a config option

						var key_start = key.replace(/_([a-z]+)$/, '');
						var key_end = key.replace(/.*_([a-z]+)$/, "$1");

						if(!data.report[key_start]) continue;

						if(data.report[key_start] == true) // replace true with {}
							data.report[key_start] = {}

						data.report[key_start][key_end] = val;

					}

				}

			} else {

				var action = {
					name: module_data.name == 'system' ? 'hardware_scan' : module_data.name,
					version: module_data.version,
					options: module_options
				}

				data.actions.push(action);

			}

		}

		if(process.env.DEBUG) console.log(data);
		callback(data);

	}

}

module.exports = ResponseParser;
