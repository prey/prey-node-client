//////////////////////////////////////////
// Prey Response Parser
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		logger = common.logger,
		exec = require('child_process').exec,
		xml2js = require('xml2js'),
		crypto = require('crypto');

var ResponseParser = {

	log: function(str){
		logger.info('[parser] ' + str);
	},

	parse: function(data, options, callback){
		
		var self = this;

		// if we haven't tried to decrypt yet, and it seems encrypted
		if(!options.decrypted && data.indexOf('<html>') == -1 && data.indexOf('config') == -1){

			this.decrypt_response(data, options.key, function(output){
				options.decrypted = true;
				// console.log(output);
				self.parse(output, options, callback);
			});

		// check if its an xml
		} else if(data.indexOf('<config') != -1){

			this.parse_xml(data, function(err, result){
				if(err)
					callback(err);
				else if(result.modules) // old XML
					self.build_new_schema(result, callback);
				else
					callback(null, result);
			});

		// look for application/js(on) or application/javascript
		} else {

			try {
				callback(null, JSON.parse(data));
			} catch(e){
				callback(new Error("Unkown data type received."));
			}

		}

	},

	// all the slice mumbo-jumbo is to provide full compatibility with 
	// the command-line openssl command, used in the bash client.
	decrypt_response: function(data, key, callback){

		this.log("Got encrypted response. Decrypting...");
		var hashed_key = key.length == 32 ? key : crypto.createHash('md5').update(key).digest("hex");

		var buf = new Buffer(data, 'base64');
		var raw = buf.toString('binary');

		var pad = raw.slice(0, 8);
		var salt = raw.slice(8, 16);
		var raw = raw.slice(16);

		var decipher = crypto.createDecipher('aes-128-cbc', hashed_key + salt);
		var dec = decipher.update(raw, 'binary', 'utf8');
		dec += decipher.final('utf8');
		
		callback(dec);

	},

	parse_xml: function(body, callback){
		
		// console.log(data);

		logger.debug('Parsing XML...')
		var xml_parser = new xml2js.Parser();

		xml_parser.on('end', function(result) {
			callback(null, result);
		});

		xml_parser.on('error', function(err) {
			callback(err);
		});

		xml_parser.parseString(body);

	},

	// this function builds a new instruction schema out of the old XML
	build_new_schema: function(original, callback){
		
		// if(process.env.DEBUG) console.log(original);
		
		var excluded_settings = ['current_release', 'delay', 'auto_update', 'post_url'];
		
		var data = {
			current_release: original.configuration.current_release,
			missing: original.status && original.status.missing == 'true' ? true : false,
			delay: parseInt(original.configuration.delay),
			auto_update: original.configuration.auto_update == 'y' ? true : false,
			settings: {},
			drivers: {},
			info: {},
			endpoints: {
			//	events: {
			//		control_panel: { url: common.device.events_url }
			//	}
			}
		}
		
		for(key in original.configuration){
			if(excluded_settings.indexOf(key) == -1)
				data.settings[key] = original.configuration[key]['#'] || original.configuration[key];
		}

		// events endpoint expects a PUT
		// data.destinations.events.control_panel.method = 'put';

		if(original.configuration.post_url)
			data.endpoints.report = {
				control_panel: {
					url: original.configuration.post_url
				}
			}

		if(original.configuration.on_demand_mode){
			data.drivers.on_demand = {
				host: original.configuration.on_demand_host,
				port: parseInt(original.configuration.on_demand_port)
			}
		}

		data.actions = [];
		var report_opts = {};

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
					report_opts.picture = true;
					continue;
				}

				for(key in module_options){

					var val = module_options[key];
					if(val == 'n' || val == 'false') continue;

					if(/^get_/.test(key)){
						report_opts[key.replace('get_', '')] = true;
					} else if (val == 'y' || val == 'true'){
						report_opts[key] = true;
					} else { // check if we got a config option

						var key_start = key.replace(/_([a-z]+)$/, '');

						if(!report_opts[key_start]) continue;

						if(report_opts[key_start] == true) // replace true with {}
							report_opts[key_start] = {}

						var key_end = key.replace(/.*_([a-z]+)$/, "$1");

						report_opts[key_start][key_end] = val;

					}

				}

			} else {

				var action = {
					name: module_data.name == 'system' ? 'hardware-scan' : module_data.name,
					version: module_data.version,
					options: module_options
				}

				if(action.name == 'hardware-scan')
					data.info.specs = module_options;
				else
					data.actions.push(action);

			}

		}

		if(Object.keys(report_opts).length > 0) 
			data.info.location = report_opts;
			// data.actions.push({name: 'report', options: report_opts});

		if(process.env.DEBUG) console.log(data);
		callback(null, data);

	}

}

module.exports = ResponseParser;
