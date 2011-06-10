#!/usr/local/bin/node

//////////////////////////////////////////
// Prey JS Client
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

// set globals that are needed for all descendants
GLOBAL.base_path = __dirname;
GLOBAL.script_path = __filename;
GLOBAL.os_name = process.platform.replace("darwin", "mac");

require.paths.unshift(__dirname);

// base requires

require('./lib/core_extensions');

var path = require('path'),
		fs = require("fs"),
		crypto = require('crypto'),
		tcp = require("net"),
		sys = require("sys"),
		url = require('url'),
		connection = require('./core/connection'),
		child = require('child_process'),
		command = require('./lib/command'),
		updater = require('./core/updater'),
		OnDemand = require('./core/on_demand'),
		http_client = require('./lib/http_client'),
		Module = require('./core/module');

// aliases

var config_file_path = './config'
var config = require(config_file_path).main;

var version = fs.readFileSync(base_path + '/version').toString().replace("\n", '');
GLOBAL.args = require('./core/args').init(version);

require('./lib/logger');

////////////////////////////////////////
// helper methods
////////////////////////////////////////


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
		return os.temp_path + filename;
	},

	store_config_value: function(key_name){
		var value = config[key_name];
		this.replace_in_file(config_file_path, "\t" + key_name+"=.*", key_name + "='" + value + "';")
	},

//	replace_in_file: function(file_name, from, to){
//		fs.readFile(file_name, function (err, data) {
//			if (err) throw err;
//			if(new_data != data) self.save_file_contents(file_name, new_data)
//		});
//	},

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

		this.os = require('./platform/' + os_name);
		this.user_agent = "Prey/" + version + " (NodeJS, "  + os_name + ")";
		this.logged_user = process.env['USERNAME'];
		this.started_at = new Date();

		log("\n  PREY " + version + " spreads its wings!");
		log("  " + self.started_at)
		log("  Running on a " + os_name + " system as " + self.logged_user + "\n");

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
		if(config.post_methods.indexOf('http') != -1)
			Check.http_config();
		if(config.post_methods.indexOf('smtp') != -1)
			Check.smtp_config();
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

			if(!self.requested.modules || self.requested.modules.length == 0) {
				log(" -- No report or actions requested.");
				return false;
			}

			self.process_module_config(function(){
				debug("Traces gathered:\n" + inspect(self.traces));

				if (self.missing && self.traces.count() > 0)
					self.send_report();
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
		xml2js = require('./vendor/xml2js');

		var parser = new xml2js.Parser();

		parser.addListener('end', function(result) {
				log(' -- XML parsing complete.');
				callback(result);
		});

		parser.parseString(data);

	},

	process_main_config: function(){

		log(" -- Processing main config...")
		debug(inspect(self.requested));

		if(typeof(config.auto_update) == 'boolean')
			self.auto_update = config.auto_update;
		else
			self.requested.configuration.auto_update || false;

		self.missing = (self.response.statusCode == config.missing_status_code);

		var status_msg = self.missing ? "Device is missing!" : "Device not missing. Sweet.";
		log(" -- " + status_msg);

		self.process_delay();

		if(self.requested.configuration.on_demand_mode){
			log(' -- On Demand mode enabled! Connecting...');
			var on_demand_host = self.requested.configuration.on_demand_host;
			var on_demand_port = self.requested.configuration.on_demand_port;
			self.on_demand_stream = OnDemand.connect(on_demand_host, on_demand_port, config, version);
		}

	},

	process_delay: function(){

		var requested_delay = self.requested.configuration.delay;

		self.os.check_current_delay(script_path, function(current_delay){
			debug("Current delay: " + current_delay + ", requested delay: " + requested_delay);
			if(parseInt(current_delay) != parseInt(requested_delay)){
				log(" -- Setting new delay!")
				self.platform.set_new_delay(requested_delay, script_path);
			}
		});

	},

	process_module_config: function(callback){

		log(" -- Processing modules...")
		var requested_modules_count = self.requested.modules.module.length;
		var modules_returned = 0;

		for(id in self.requested.modules.module){

			var module_config = self.requested.modules.module[id];
			if(typeof(module_config) !== "object") continue;

			var module_data = module_config['@'];
			log(" -- Got instructions for " + module_data.type + " module " + module_data.name);

			delete module_config['@'];

			var module_options = {
				config: module_config,
				upstream_version: module_data.version,
				update: self.auto_update
			}

			var prey_module = Module.new(module_data.name, module_options);

			prey_module.on('end', function(traces){

				var traces_count = traces.count();
				log(" -- " + this.name + " module returned. " + traces_count + " traces gathered.");

				if(traces_count > 0) self.traces[this.name] = traces;

				modules_returned++;
				if(modules_returned >= requested_modules_count){
					log(" ++ All modules are done! Packing report...");
					callback();
				}

			});

			prey_module.run();

		}

	},

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

	send_report: function(){

		config.post_methods.forEach(function(post_method) {
			var report_method = "send_" + post_method + "_report";
			self[report_method](report_method, self.traces);
		});

	},

	send_http_report: function(data){

		if(self.requested.configuration.post_url)
			var post_url = self.requested.configuration.post_url.replace(".xml", "")
		else
			var post_url = config.check_url + "/devices/" + config.device_key + "/reports.xml";

		log(" -- Sending report!");

		var options = {
			user: config.api_key,
			pass: "x",
			headers : { "User-Agent": self.user_agent }
		}

		http_client.post(post_url, data, options, function(response, body){
			log(' -- Got status code: ' + response.statusCode);
			log(' -- ' + body);
		})

	},

	send_smtp_report: function(data){

	},

	clean_up: function(){
		log(" -- Cleaning up!");
	}

}

var Check = {
	installation: function(){
		log(" -- Verifying Prey installation...")
	},
	http_config: function(){
		log(" -- Verifying API and Device keys...")
	},
	smtp_config: function(){
		log(" -- Verifying SMTP settings...")
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
