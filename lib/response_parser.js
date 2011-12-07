//////////////////////////////////////////
// Prey Response Parser
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		Command = require('command'),
		xml2js = require('xml2js'),
		crypto = require('crypto');

var ResponseParser = {

	log: function(str){
		logger.info(str);
	},

	parse: function(data, options, callback){

		// if we haven't tried to decrypt yet, and it seems encrypted
		if(!options.decrypted && data.indexOf('config') == -1){

			this.decrypt_response(data, options.key, function(output){
				options.decrypted = true;
				// console.log(output);
				ResponseParser.parse(output, options, callback);
			});

		// match either application/xml or text/xml
		} else if(options.type.indexOf('xml') != -1){

			this.parse_xml(data, function(result){
				if(result.modules) // old XML
					ResponseParser.build_new_schema(result, callback);
				else
					callback(result);
			});

		// look for application/js(on) or application/javascript
		} else if(options.type.indexOf('js') != -1 || options.type.indexOf('javascript')){

			// try {
				callback(JSON.parse(data));
			// } catch(e){ }

		} else {

			this.log("Unkown data data received.");
			callback(false);

		}

	},

	decrypt_response: function(data, key, callback){

		this.log(" -- Got encrypted response. Decrypting...")
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

		this.log(' -- Parsing XML...')
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
			missing: original.status.missing == 'true',
			delay: parseInt(original.configuration.delay),
			auto_update: original.configuration.auto_update ? true : false,
			offline_actions: original.configuration.offline_actions ? true : false,
		}

		if(original.configuration.post_url)
			data.post_url = original.configuration.post_url;

		if(original.configuration.on_demand_mode){
			data.on_demand = {
				host: original.configuration.on_demand_host,
				port: parseInt(original.configuration.on_demand_port)
			}
		}

		data.actions = [];
		data.report  = {};

		for(id in original.modules.module){

			var module_main = module_config = original.modules.module[id];
			if(!module_main) continue;

			var module_data = module_main['@'];
			delete module_config['@'];

			if(module_data.type == 'report'){

				if(module_data.name == 'webcam'){
					data.report.picture = true;
					continue;
				}

				for(key in module_config){

					var val = module_config[key];
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
					config: module_config
				}

				data.actions.push(action);

			}

		}

		callback(data);

	}

}

module.exports = ResponseParser;
