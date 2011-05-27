#!/usr/local/bin/node

//////////////////////////////////////////
// Prey JS Client
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var config_file_path = './config'

// base requires

require('./lib/core_extensions');

var path = require('path'),
		fs = require("fs"),
		crypto = require('crypto'),
		tcp = require("net"),
		sys = require("sys"),
		util = require('util'),
		url = require('url'),
		connection = require('./core/connection'),
		child = require('child_process'),
		command = require('./lib/command'),
		updater = require('./core/updater'),
		http_client = require('./lib/http_client'),
		// rest = require('./lib/restler');
		Module = require('./core/module');

// aliases

var inspect = util.inspect, log = console.log;

var base_path = __dirname;
var full_path = __filename;

var version = fs.readFileSync(base_path + '/version').toString().replace("\n", '');
var args = require('./core/args').init(version);
var config = require(config_file_path).main;

var crypto = require('crypto');

////////////////////////////////////////
// helper methods
////////////////////////////////////////

function debug(msg){
	if(args.get('debug')) util.debug(msg)
}

function quit(msg){
	log(" !! " + msg)
	process.exit(1)
}

////////////////////////////////////////
// models
////////////////////////////////////////

var Prey = {

	response: false,
	traces: {},
	modules: { action: [], report: []},
	last_response_file: 'last-response.xml',
	auto_connect_attempts: 0,

	tempfile_path: function(filename){
		return '/tmp' + filename;
	},

	store_config_value: function(key_name){
		var value = config[key_name];
		this.replace_in_file(config_file_path, "\t" + key_name+"=.*", key_name + "='" + value + "';")
	},

	replace_in_file: function(file_name, from, to){
		fs.readFile(file_name, function (err, data) {
			if (err) throw err;
			if(new_data != data) self.save_file_contents(file_name, new_data)
		});
	},

	save_file_contents: function(file_name, data){
		fs.writeFile(file_name, data, function (err) {
			if (err) throw err;
			console.log(' -- File saved.');
		});
	},

	auto_register: function(callback){

		var uri = config.check_url + '/devices.xml';

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

			debug("Response body: " + response.body);
			log(' -- Got status code: ' + response.statusCode);

			if(response.statusCode == 201){
				log(" -- Device succesfully created.");
				this.parse_xml(response, function(result){
					if(result.key){
						log("Assigning device key to configuration...")
						config.device_key = result.key;
						this.store_config_value('device_key');
						callback()
					}
				})
			}
		})

	},

	setup: function(callback){

		this.os_name = process.platform.replace("darwin", "mac");
		this.os = require('./platform/' + this.os_name + '/functions');
		this.user_agent = "Prey/" + version + " (NodeJS, "  + this.os_name + ")";
		this.logged_user = process.env['USERNAME'];
		this.started_at = new Date();

		log("\n  PREY " + version + " spreads its wings!");
		log("  " + self.started_at)
		log("  Running on a " + self.os_name + " system as " + self.logged_user + "\n");

		if(config.device_key == ""){
			log(" -- No device key found.")
			if(config.api_key == ""){
				log(" -- No API key found! Please set up Prey and try again.")
			} else {
				self.auto_register(callback)
			}
		} else {
			callback();
		}

	},

	check: function(){
		Check.installation();
		if(config.post_method == 'http')
			Check.http_keys();
		else
			Check.smtp_settings();
	},

	run: function(){

		self = this;
		self.setup(function(){

			self.check_connection();

		});

	},

	check_connection: function(){

		console.log(" -- Checking connection...");
		var conn = connection.check();

		conn.on('found', function(){
			log(" -- Connection found!");
			args.get('check') ? self.check() : self.fetch()
		});

		conn.on('not_found', function(){

			log(" !! No connection found.");
			if(config.auto_connect && self.auto_connect_attempts < config.max_auto_connect_attempts){

				self.auto_connect_attempts++;
				log(" -- Trying to auto connect...");

				self.os.auto_connect(setTimeout(function(){
					self.check_connection();
					}, 5000)
				);

			}

		});

	},

	no_connection: function(){
		if(path.exists(tempfile_path(this.last_response_file))){
			this.instructions = last_response;
		}

		quit("No connection available.")
	},

	valid_status_code: function(){
		return self.response.statusCode == 200 || self.response.statusCode == 404;
	},

	fetch: function(){

		log(" -- Fetching instructions.")

		self.fetch_xml(function(response_body){

			if(!self.valid_status_code())
				quit("Unexpected status code received.")

			if(self.response.headers["content-type"].indexOf('/xml') == -1)
				quit("No valid instructions received.")

			self.process(response_body);

		})


	},

	process: function(body){

		self.parse_response(body, function(body){

			self.requested = body;
			self.process_main_config();

			if(!self.requested.modules.modules) {
				log(" -- No report or actions requested.");
				return false;
			}

			self.process_module_config(function(){
				debug("Traces gathered:\n" + inspect(self.traces));

				if (self.missing && self.traces.count() > 0)
					self.send_report(config.post_method);
				else
					log(" -- Nothing to send!")

			});

		});

	},

	decrypt_response: function(data, callback){

		console.log(" -- Got encrypted response. Decrypting...")
		var key = crypto.createHash('md5').update(config.api_key).digest("hex");

//			var decipher = (new crypto.Decipher).init("bf-cbc", key);
//			var txt = decipher.update(data, 'base64', 'utf-8');
//			txt += decipher.final('utf-8');
//			log("RESULT: " + txt);

		var cmd_str = 'echo "' + data + '" | openssl aes-128-cbc -d -a -salt -k "' + key +'" 2> /dev/null'
		var cmd = command.run(cmd_str);

		cmd.on('error', function(message){
			quit("Couldn't decrypt response. This shouldn't have happened!")
		})

		cmd.on('return', function(output){
			// insert comments back on node attributes
			xml = output.replace(/=([^\s>\/]+)/g, '="$1"');
			// console.log(xml);
			// return xml;
			self.parse_xml(xml, callback);
		})

	},

	parse_response: function(data, callback){

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
				callback(result);
		});

		parser.parseString(data);

	},

	process_main_config: function(){

		log(" -- Processing main config...")
		debug(inspect(self.requested_configuration));

		if(typeof(config.auto_update) == 'boolean')
			self.auto_update = config.auto_update;
		else
			self.requested.configuration.auto_update || false;

		self.missing = (self.response.statusCode == config.missing_status_code);

		var status_msg = self.missing ? "Device is missing!" : "Device not missing. Sweet.";
		log(" -- " + status_msg);

		self.process_delay();

		if(self.requested.configuration.on_demand_mode){
			log(' -- On Demand mode enabled!');
			var on_demand_host = self.requested.configuration.on_demand_host;
			var on_demand_port = self.requested.configuration.on_demand_port;
			// OnDemand.connect(on_demand_host, on_demand_port);
		}

	},

	process_delay: function(){

		var requested_delay = self.requested.configuration.delay;

		self.os.check_current_delay(full_path, function(current_delay){
			debug("Current delay: " + current_delay + ", requested delay: " + requested_delay);
			if(current_delay != requested_delay){
				log(" -- Setting new delay!")
				self.platform.set_new_delay(requested_delay, full_path);
			}
		});

	},

	process_module_config: function(callback){

		log(" -- Processing modules...")
		var requested_modules_count = self.requested.modules.module.length;
		var modules_ran = 0;

		for(id in self.requested.modules.module){

			var module_config = self.requested.modules.module[id];
			if(typeof(module_config) !== "object") continue;

			var module_attrs = module_config['@'];
			var module = Module.new(module_attrs);

			log(" -- Got instructions for " + module.type + " module " + module.name);

			delete module_config['@'];
			module.init(module_config, self.auto_update);

			module.on('ready', function(){
				// self.enqueue_module(module.type, module)
				this.run();
			})

			module.on('error', function(err_msg){
				log(" !! " + err_msg);
			})

			module.on('end', function(traces){

				var traces_count = traces.count();
				log(" -- " + this.name + " module returned. " + traces_count + " traces gathered.");

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

	fetch_xml: function(callback){

		var uri = config.check_url + '/devices/' + config.device_key + '.xml';
		var options = { headers: { "User-Agent": self.user_agent } }

		http_client.get(uri, options, function(response, body){
			debug("Response headers:\n" + inspect(response.headers));
			debug("Response body:\n" + body);
			self.response = response;
			log(' -- Got status code: ' + response.statusCode);
			callback(body);
		})

	},

	send_report: function(method){

		if(method == "http"){
			if(self.requested.configuration.post_url)
				var post_url = self.requested.configuration.post_url.replace(".xml", "")
			else
				var post_url = config.check_url + "/devices/" + config.device_key + "/reports.xml";

			self.send_http_report(post_url, self.traces);
		}

	},

	send_http_report: function(url, data){

		log(" -- Sending report!");
		debug("Post URL is: " + url);

		var options = {
			user: config.api_key,
			pass: "x",
			headers : { "User-Agent": self.user_agent }
		}

		http_client.post(url, data, options, function(response, body){
			log(' -- Got status code: ' + response.statusCode);
			log(' -- ' + body);
		})

	},

	clean_up: function(){
		log(" -- Cleaning up!");
	}

}

var Check = {
	installation: function(){
		log(" -- Verifying Prey installation...")
	},
	http_keys: function(){
		log(" -- Verifying API and Device keys...")
	},
	smtp_settings: function(){
		log(" -- Verifying SMTP settings...")
	}
}

var OnDemand = {

	connect: function(host, port){
		var self = this;
		this.stream = tcp.createConnection(port, host);

		this.stream.on("connect", function(){
			self.handshake()
			log("Connection established. Sending authentication.");
		})

		this.stream.on("data", function(data){
			log("Data received:" + data);
			var msg = JSON.parse(data);
			if(msg.event == "ping")
				this.pong();
		})

		this.stream.on("end", function(){
			log("Connection ended");
		})

		this.stream.on("close", function(had_error){
			log("Connection closed.")
		})

	},

	register: function(){
		var data = {
			client_version: version,
			key: config.device_key,
			group: config.api_key,
			protocol: 1
		}
		this.send({ action: 'connect', data: data} )
	},

	pong: function(){
		this.send({ action: 'ping', data: {timestamp: Date.now().toString() }})
	},

	send: function(msg){
		this.stream.write(JSON.stringify(msg))
	}

}

/////////////////////////////////////////////////////////////
// event handlers
/////////////////////////////////////////////////////////////

process.on('exit', function () {
	Prey.clean_up();
	log(" -- Shutting down!\n");
});

//process.on('uncaughtException', function (err) {
//  log('Caught exception: ' + err);
//});

/////////////////////////////////////////////////////////////
// signal handlers
/////////////////////////////////////////////////////////////

process.on('SIGINT', function () {
  log(' >> Got Ctrl-C!');
  process.exit(0);
});

Prey.run()
