#!/usr/local/bin/node

/*
 * Prey JS Client
 * (c) 2011 - Fork Ltd.
 * by Tomas Pollak
 * http://usefork.com
 * GPLv3 Licensed
 */

var path = require('path'),
		fs = require("fs"),
		crypto = require('crypto'),
		tcp = require("net"),
		http = require('http'),
		sys = require("sys"),
		util = require('util'),
		child = require('child_process'),
		system = require('./core/system'),
		updater = require('./core/updater');

var base_path = __dirname;
var full_path = __filename;
var log = sys.puts;

var config = {
	auto_connect: true,
	missing_status_code: 404,
	device_key: 'ixd9tk'
}

var Status = {
	connected: false
}

var Prey = {

	check_mode: false,
	last_response: true,
	config: {},
	modules: { action: [], report: []},
	response: false,

	setup: function(){

		this.version = fs.readFileSync(base_path + '/version').toString().replace("\n", '');
		this.os = process.platform.replace("darwin", "mac");
		this.platform = require('./platform/' + this.os + '/functions');
		this.user_agent = "Prey/" + this.version + " ("  + this.os + ")";
	},

	go: function(){

		self = this;
		this.setup()
		console.log("\n  PREY " + self.version + " spreads its wings!");
		console.log()
		this.check_mode ? this.check() : this.run()

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
		console.log(" -- No connection available. Exiting...")
		process.exit(1);
	},

	wake: function(){

		self.fetch_instructions(function(data){
			self.parse_instructions(data, function(){
				self.process_main_config();
				self.process_module_config();

				if(self.response.statusCode == config.missing_status_code){
					console.log("HOLY GUACAMOLE!");
					self.gather_report();
				}

				if(self.modules.action.length > 0){
					self.run_pending_actions();
				}
			});
		})

		console.log(" -- Ready.")

	},

	parse_instructions: function(data, callback){

		// console.log("Got instructions:" + data);
		xml2js = require('./lib/xml2js');

		var parser = new xml2js.Parser();

		parser.addListener('end', function(result) {
				// console.log(sys.inspect(result));
				console.log(' -- XML parsing complete.');
				self.requested = result;
				callback();
		});

		parser.parseString(data);

	},

	process_main_config: function(){
		console.log(" -- Processing main config...")

		var requested_delay = self.requested.configuration.delay;

		self.platform.check_current_delay(full_path, function(current_delay){
			util.debug("Current delay: " + current_delay + ", requested delay: " + requested_delay);
			if(current_delay != requested_delay){
				console.log(" -- Setting new delay!")
				self.platform.set_new_delay(requested_delay, full_path);
			}
		});

	},

	process_module_config: function(){
		console.log(" -- Processing module config...")

		for(id in self.requested.modules.module){

			var module_data = self.requested.modules.module[id]['@']

			var module = new Module(module_data.name, module_data.type, upstream_version);
			console.log(" -- Got instructions for " + module.type + " module " + module.name);

			var upstream_version = self.requested.configuration.auto_update ? module_data.version : false;

			module.init(upstream_version, function(){
				self.enqueue_module(module.type, module.name)
			})

//			if(!module.installed || !module.up_to_date){
//				module.fetch(function(success){
//					if(success) self.enqueue_module(module.type, module.name)
//				});
//			} else {
//				self.enqueue_module(module.type, module.name)
//			}

		}

	},

	enqueue_module: function(type, name){

		console.log(" -- Queueing module " + name + " for later execution...")
		self.modules[type].push(name);

	},

	gather_report: function(){

		console.log("\n >> Getting report...\n");
		self.run_modules('report');

	},

	run_pending_actions: function(){

		console.log("\n >> Running pending actions...\n");
		self.run_modules('action');

	},

	run_modules: function(type){

		self.modules[type].forEach(function(module_name){
			console.log(" -- Running " + module_name + " module...")
			module_class = require('./modules/' + module_name + "/core");
			current_module = new module_class.module();

			current_module.on('end', function(data){
				self.traces[module] = data;
			})

		});

	},

	fetch_instructions: function(callback){

		var http_client = http.createClient(80, 'control.preyproject.com');

		var headers = {
			"Host": 'www.google.com',
			"User-Agent": "Prey/" + self.user_agent
		}

		var request_path = '/devices/' + config.device_key + '.xml';
		var request = http_client.request('GET', request_path, headers);
		request.end();

		request.on('response', function (response) {
			self.response = response;
			console.log(' -- Got status code: ' + response.statusCode);
			// console.log('HEADERS: ' + JSON.stringify(response.headers));
			response.setEncoding('utf8');
			response.on('data', function (chunk) {
				// console.log('BODY: ' + chunk);
				callback(chunk);
			});
		});

	},

	check: function(){
		Check.installation();
		if(config.post_method == 'http')
			Check.http_keys();
		else
			Check.smtp_settings();
	}

}

function Module(name, type) {

	var self = this;
	this.name = name;
	this.type = type;
	this.path = base_path + "/modules/" + name;

	this.download = function(callback){
		console.log("Updating module " + this.name + "!")
		var update = updater.module(this.name);
		update.on('success', function(){
			console.log("all good!")
		});
		update.on('error', function(){
			console.log('Error downloading package.')
		})
	};

	this.check_version = function(upstream_version, callback){
		console.log('Checking version...')
		// get version and check if we need to update
		fs.readFile(this.path + "/version", function(err, data){
			if(err) return;
			this.version = parseFloat(data);
			if(upstream_version > this.version){
				console.log(upstream_version + " is newer than installed version: " + this.version);
				self.download(callback);
			} else {
				callback();
			}
		})
	};

	this.init = function(upstream_version, callback){

		// download module in case it's not there
		path.exists(this.path, function(exists) {
			if(!exists)
				self.download(callback);
			else if(upstream_version)
				self.check_version(upstream_version, callback);
			else
				callback();

		});

	}

}

var Check = {
	installation: function(){
		console.log("Verifying Prey installation...")
	},
	http_keys: function(){
		console.log("Verifying API and Device keys...")
	},
	smtp_settings: function(){
		console.log("Verifying SMTP settings...")
	}
}

var Connection = {

	ensure: function(){
		Status.connected = this.established;
	},

	established: function(){
		console.log("Checking connection...");
		// create the TCP stream to the server
		var stream = net.createConnection(port, address);

		stream.on('connect', function() {
			console.log('Connection success!');
			stream.end();
		});

		// listen for any errors
		stream.on('error', function(error) {
			console.log('error: ' + error);
			stream.destroy(); // close the stream
		})
		return true;
	}
}

var Wifi = {
	autoconnect: function(){
		console.log("Trying to connect...")
		return true;
	}
}

/////////////////////////////////////////////////////////////
// event handlers
/////////////////////////////////////////////////////////////

process.on('exit', function () {
	console.log(' -- Shutting down!');
});

//process.on('uncaughtException', function (err) {
//  console.log('Caught exception: ' + err);
//});

/////////////////////////////////////////////////////////////
// signal handlers
/////////////////////////////////////////////////////////////

process.on('SIGINT', function () {
  console.log('Got SIGINT.  Press Control-D to exit.');
});

Prey.go()
