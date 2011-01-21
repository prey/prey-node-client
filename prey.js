#!/usr/local/bin/node

//////////////////////////////////////////
// Prey JS Client
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

// base requires

require('./lib/core_extensions');

var path = require('path'),
		fs = require("fs"),
		crypto = require('crypto'),
		tcp = require("net"),
		sys = require("sys"),
		util = require('util'),
		url = require('url'),
		child = require('child_process'),
		command = require('./lib/command'),
		updater = require('./core/updater'),
		crypto = require('crypto'),
		http_client = require('./lib/http_client'),
		// rest = require('./lib/restler');
		Module = require('./core/module');

// aliases

var inspect = util.inspect,
		exit = process.exit,
		log = console.log;

var base_path = __dirname;
var full_path = __filename;

var version = fs.readFileSync(base_path + '/version').toString().replace("\n", '');
var args = require('./core/args').init(version);
var config = require('./config').main;

var crypto = require('crypto');

var Status = {
	connected: false
}

var Prey = {

	check_mode: false,
	last_response: true,
	modules: { action: [], report: []},
	response: false,
	traces: {},

	setup: function(callback){

		this.os = process.platform.replace("darwin", "mac");
		this.platform = require('./platform/' + this.os + '/functions');
		this.user_agent = "Prey/" + version + " (NodeJS, "  + this.os + ")";

		if(config.device_key == ""){
			log(" -- No device key found.")
			if(config.api_key == ""){
				log(" -- No API key found! Please set up Prey and try again.")
			} else{
				self.register_to_account(callback)
			}
		} else {
			callback()
		}

	},

	register_to_account: function(){

	},

	go: function(){

		self = this;
		self.setup(function(mode){
			log("\n  PREY " + version + " spreads its wings!\n");
			self.mode == "check" ? self.check() : self.run()
		})

	},

	run: function(){

		Connection.ensure()

		if(!Status.connected){
			if(this.last_response)
				this.instructions = last_response
			else
				this.no_connection();
		}

		if(!Status.connected && config.auto_connect){
			Wifi.autoconnect(setTimeout(function(){
					Status.connected ? this.wake() : this.no_connection();
				}, 5000)
			);
		} else {
			this.wake();
		}

	},

	no_connection: function(){
		log(" -- No connection available. Exiting...")
		process.exit(1);
	},

	wake: function(){

		self.fetch_instructions(function(body){

			if(self.response.headers["content-type"].indexOf('/xml') != -1){

				self.parse_response(body, function(results){

					self.process_main_config();
					self.process_module_config(function(){
						// console.log(self.traces);

						if (self.traces.count() > 0)
							self.send_report(config.post_method);
						else
							log("No traces gathered. Nothing to send!")

					});

				});

			} else {

				self.run_instructions();

			}

		})

		log(" -- Ready.")

	},

	decrypt_response: function(data, callback){

		console.log(" -- Got encrypted response. Decrypting...")
		var key = crypto.createHash('md5').update(config.api_key).digest("hex");

//			var decipher = (new crypto.Decipher).init("bf-cbc", key);
//			var txt = decipher.update(data, 'base64', 'utf-8');
//			txt += decipher.final('utf-8');
//			log("RESULT: " + txt);

		var cmd_str = 'echo "' + data + '" | openssl bf-cbc -d -a -salt -k "' + key +'" 2> /dev/null'
		var cmd = command.run(cmd_str);

		cmd.on('error', function(message){
			log(" !! Couldn't decrypt response. This shouldn't have happened!")
			exit(1)
		})

		cmd.on('return', function(output){
			// insert comments back on node attributes
			xml = output.replace(/=([^\s>\/]+)/g, '="$1"');
			// return xml;
			self.parse_xml(xml, callback);
		})

	},

	parse_response: function(data, callback){

		// log(" -- Got response:\n" + data);

		if(data.indexOf('<device>') == -1)
			self.decrypt_response(data, callback);
		else
			self.parse_xml(data, callback);

	},

	parse_xml: function(data, callback){

		log(' -- Parsing XML...')
		xml2js = require('./lib/xml2js');

		var parser = new xml2js.Parser();

		parser.addListener('end', function(result) {
				log(' -- XML parsing complete.');
				self.requested = result;
				callback(result);
		});

		parser.parseString(data);

	},

	process_main_config: function(){

		log(" -- Processing main config...")
		self.process_delay();

	},

	process_delay: function(){

		var requested_delay = self.requested.configuration.delay;

		self.platform.check_current_delay(full_path, function(current_delay){
			util.debug("Current delay: " + current_delay + ", requested delay: " + requested_delay);
			if(current_delay != requested_delay){
				log(" -- Setting new delay!")
				self.platform.set_new_delay(requested_delay, full_path);
			}
		});

	},

	process_module_config: function(callback){

		log(" -- Processing module config...")
		var auto_update = self.requested.configuration.auto_update;
		var requested_modules_count = self.requested.modules.module.length;
		var modules_ran = 0;

		for(id in self.requested.modules.module){

			var module_config = self.requested.modules.module[id];
			if(typeof(module_config) !== "object") continue;

			var module_attrs = module_config['@'];
			var module = Module.new(module_attrs);

			log(" -- Got instructions for " + module.type + " module " + module.name);

			delete module_config['@'];
			module.init(module_config, true);

			module.on('ready', function(){
				// self.enqueue_module(module.type, module)
				this.run();
			})

			module.on('error', function(err_msg){
				log(" !! " + err_msg);
			})

			module.on('end', function(traces){

				// var msg = traces.empty ? "no traces" : "some traces";
				// log(" -- Got " + msg + " from " + module.name + " module.");
				var traces_count = traces.count();
				log(" -- " + this.name + " returned. " + traces_count + " traces.");
				if(traces_count > 0) self.traces[this.name] = traces;

				modules_ran++;
				if(modules_ran >= requested_modules_count){
					log(" ++ All modules are done! Packing report...");
					callback();
				}

			});

		}

	},

	enqueue_module: function(type, module){

		log(" -- Queueing module " + module.name + " for execution...")
		self.modules[type].push(module);

	},

//	run_instructions: function(){

//		if(self.response.statusCode == config.missing_status_code){
//			log(" !! HOLY GUACAMOLE!");
//			self.gather_report();
//		} else {
//			log(" -- Nothing to worry about.")
//		}

//		if(self.modules.action.length > 0){
//			self.run_pending_actions();
//		}
//	},

//	gather_report: function(){

//		log("\n >> Getting report...\n");
//		self.run_modules('report', function(){
//			log("All report modules are ready");
//		});

//	},

//	run_pending_actions: function(){

//		log("\n >> Running pending actions...\n");
//		self.run_modules('action', function(){
//			log("All action modules are ready");
//		});

//	},

//	run_modules: function(type, callback){

//		var module_count = self.modules[type].length;
//		var modules_ready = 0;

//		self.modules[type].forEach(function(module){

//			module.run();

//			current_module.on('end', function(data){
//				self.traces[module] = data;
//				modules_ready++;
//				if(modules_ready >= module_count){
//					callback();
//				}
//			})

//		});

//	},

	fetch_instructions: function(callback){

		var uri = config.check_url + '/devices/' + config.device_key + '.xml';
		var headers = { "User-Agent": self.user_agent }

//		rest.get(uri, {headers: headers, parser: self.parse_response}).addListener('complete', function(data){
//			console.log(data)
//			self.response = data;
//		})

		http_client.get(uri, headers, function(response, body){
			self.response = response;
			log(' -- Got status code: ' + response.statusCode);
			callback(body);
		})

	},

	send_report: function(method){

		if(method == "http")
			self.send_http_report(self.requested.configuration.post_url.replace(".xml", ""), self.traces);

	},

	base64_encode: function(string){
		var base64_encode = require('./lib/base64').encode;
		var Buffer = require('buffer').Buffer;
		return base64_encode(new Buffer(string));
	},

	send_http_report: function(url, data){

		var authorization_key = self.base64_encode(config.api_key + ":x")

		var headers = {
			"User-Agent": self.user_agent,
			"Authorization": "Basic " + authorization_key
		}

		http_client.post(url, data, headers, function(response, body){
			log(' -- Got status code: ' + response.statusCode);
			log(' -- ' + body);
		})

	},

	check: function(){
		Check.installation();
		if(config.post_method == 'http')
			Check.http_keys();
		else
			Check.smtp_settings();
	}

}

var Check = {
	installation: function(){
		log("Verifying Prey installation...")
	},
	http_keys: function(){
		log("Verifying API and Device keys...")
	},
	smtp_settings: function(){
		log("Verifying SMTP settings...")
	}
}

var Connection = {

	ensure: function(){
		Status.connected = this.established;
	},

	established: function(){
		log("Checking connection...");
		// create the TCP stream to the server
		var stream = net.createConnection(port, address);

		stream.on('connect', function() {
			log('Connection success!');
			stream.end();
		});

		// listen for any errors
		stream.on('error', function(error) {
			log('error: ' + error);
			stream.destroy(); // close the stream
		})
		return true;
	}
}

var Wifi = {
	autoconnect: function(){
		log("Trying to connect...")
		return true;
	}
}

/////////////////////////////////////////////////////////////
// event handlers
/////////////////////////////////////////////////////////////

process.on('exit', function () {
	log(" -- Shutting down!\n");
});

//process.on('uncaughtException', function (err) {
//  log('Caught exception: ' + err);
//});

/////////////////////////////////////////////////////////////
// signal handlers
/////////////////////////////////////////////////////////////

process.on('SIGINT', function () {
  log('Got SIGINT.  Press Control-D to exit.');
});

Prey.go()
