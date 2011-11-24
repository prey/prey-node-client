//////////////////////////////////////////
// Prey JS Main Object
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var base = require('./base'),
		path = require('path'),
		fs = require("fs"),
		util = require("util"),
		emitter = require('events').EventEmitter,
		Check = require('./check'),
		Connection = require('./connection'),
		Request = require('./request'),
		ResponseParser = require('./response_parser'),
		Setup = require('./setup'),
		ModuleLoader = require('./module_loader'),
		ActionsManager = require('./actions_manager'),
		Report = require('./report'),
		OnDemand = require('./on_demand'),
		Discovery = require('./discovery');

var self;

var Main = {

	running: false,

	run: function(config, args, version){

		self = this;
		this.config = config;
		this.args = args;
		this.version = version;
		process.env.LOOP = 0;

		base.helpers.run_cmd(base.os.get_logged_user_cmd, function(user_name){
			process.env.LOGGED_USER = user_name.split("\n")[0];

			self.initialize(function(){

				self.fire();
			});

		});

	},

	fire: function(){
		process.env.LOOP++;
		this.modules = {action: [], report: []};
		this.auto_connect_attempts = 0;

		if(!Discovery.running) this.load_discovery();

		this.check_connection_and_fetch();

	},

	stop: function(){

		if(OnDemand.connected) OnDemand.disconnect();
		ActionsManager.stop_all();
		if(this.discovery_service) Discovery.stop_service();
		this.running = false;

	},

	initialize: function(callback){

		// this.check_and_store_pid();
		this.running = true;
		this.running_user = process.env['USERNAME'];
		this.started_at = new Date();

		this.user_agent = "Prey/" + this.version + " (NodeJS, "  + base.os_name + ")";
		this.config.user_agent = this.user_agent; // so we dont need to pass it all the time

		log("\n  PREY " + this.version + " spreads its wings!", 'bold');
		log("  " + this.started_at)
		log("  Running on a " + base.os_name + " system as " + this.running_user);
		log("  Current logged user: " + process.env["LOGGED_USER"]);
		log("  NodeJS version: " + process.version + "\n");

		if(this.config.device_key == ""){
			log(" -- No device key found.")
			if(this.config.api_key == ""){
				log("No API key found! Please set up Prey and try again.");
				process.exit(1);
			} else {

				var options = {
					user_agent: this.user_agent,
					check_url: this.config.check_url,
					api_key: this.config.api_key
				}

				Setup.auto_register(options, function(device_key){
					self.config.device_key = device_key;
					callback();
				});

			}
		} else {
			callback();
		}

	},

	check: function(){
		Check.installation();
		if(this.config.post_methods.indexOf('http') != -1)
			Check.http_config();
		if(this.config.post_methods.indexOf('smtp') != -1)
			Check.smtp_config();
	},

	check_connection_and_fetch: function(){

		console.log(" -- Checking connection...");
		var conn = new Connection(this.config.proxy);

		conn.on('found', function(){
			log(" -- Connection found!");
			self.args.get('check') ? self.check() : self.fetch()
		});

		conn.on('not_found', function(){

			log(" !! No connection found.");
			if(this.config.auto_connect && self.auto_connect_attempts < this.config.max_auto_connect_attempts){

				self.auto_connect_attempts++;
				log(" -- Trying to auto connect...");

				os.auto_connect(setTimeout(function(){
					self.check_connection_and_fetch();
					}, 5000)
				);

			} else {
				log(" -- Not trying any more.");
				self.no_connection();
			}

		});

	},

	no_connection: function(){

		if(path.existsSync(tempfile_path(this.config.last_response_file))){
			response_body = fs.readFileSync(this.config.last_response_file);
			this.process(response_body, true);
		}

		quit("No connection available.")
	},

	fetch: function(){

		log(" -- Fetching instructions...")

		var headers = { "User-Agent": this.user_agent };

		var req = new Request(this.config, headers, function(response, body){

			self.response_status = response.statusCode;
			self.response_content_type = response.headers["content-type"];

			// if(self.response_content_type.indexOf('/xml') == -1)
				// quit("No valid instructions received.")

			self.process(body, false);

		})

	},

	process: function(response_body, offline){

		ResponseParser.parse(response_body, this.config.api_key, function(parsed){

			self.requested = parsed;
			self.process_main_config();

			if(!self.requested.modules || Object.keys(self.requested.modules).length == 0) {
				log(" -- No report or actions requested.");
				return false;
			}

			if(offline == false && self.requested.configuration.offline_actions)
				base.helpers.save_file_contents(this.config.last_response_file, response_body);

			self.process_module_config(function(){

				console.log(' -- All modules loaded.')
				ActionsManager.initialize(self.modules.action);

				if(self.missing && self.modules.report.length > 0) {

					var report = new Report(self.modules.report, self.requested.configuration);
					report.once('ready', function(){

						ActionsManager.start_all();

						if(Object.keys(report.traces).length > 0)
							report.send_to(self.config.destinations, self.config);
						else
							log(" -- Nothing to send!")
					});

					report.gather();

				} else {

					ActionsManager.start_all();

				}

//				if(self.loops < 2){

//					setTimeout(function(){
//						self.fire();
//					}, 2000);

//				}

			});

		});

	},

	process_main_config: function(){

		log(" -- Processing main config...")
		// debug(self.requested);

		if(typeof(this.config.auto_update) == 'boolean')
			self.auto_update = this.config.auto_update;
		else
			self.auto_update = self.requested.configuration.auto_update || false;

		self.missing = (self.response_status == this.config.missing_status_code);

		var status_msg = self.missing ? "Device is missing!" : "Device not missing. Sweet.";
		log(" -- " + status_msg);

		self.process_delay();

		if(!self.on_demand && self.requested.configuration.on_demand_mode)
			self.setup_on_demand();

	},

	process_delay: function(){

		var requested_delay = self.requested.configuration.delay;

		base.os.check_current_delay(base.script_path, function(current_delay){
			log("Current delay: " + current_delay + ", requested delay: " + requested_delay);
			if(parseInt(current_delay) != parseInt(requested_delay)){
				log(" -- Setting new delay!")
				os.set_new_delay(requested_delay, base.script_path);
			}
		});

	},

	process_module_config: function(callback){

		var requested_modules = self.requested.modules.module.length || 1;
		var modules_loaded = 0;
		log(" -- " + requested_modules + " modules enabled!")

		for(id in self.requested.modules.module){

			var module_config = self.requested.modules.module[id];

			if(typeof(module_config) !== "object") continue;
//			console.log(util.inspect(module_config));

			var module_data = module_config['@'] || module_config;
			if(!module_data) continue;

			log(" -- Got instructions for " + module_data.type + " module " + module_data.name);

			delete module_config['@'];


			var version_to_pass = self.auto_update ? module_data.version : null;

			var report_modules = [], action_modules = [];
			var loader = new ModuleLoader(module_data.name, module_config, version_to_pass);

			loader.once('done', function(prey_module){

				modules_loaded++;

				if(prey_module){

					if(prey_module.type == 'report')
						self.modules.report.push(prey_module);
					else
						self.modules.action.push(prey_module);

				}

				if(modules_loaded >= requested_modules) {
					callback();
				}

			});

		}

	},

	on_demand_active: function(){
		return(this.on_demand && this.on_demand.connected);
	},

	setup_on_demand: function(){

		log(' -- On Demand mode enabled! Trying to connect...', 'bold');
		var on_demand_host = self.requested.configuration.on_demand_host;
		var on_demand_port = self.requested.configuration.on_demand_port;
		this.on_demand = OnDemand.connect(on_demand_host, on_demand_port, this.config, this.version, function(stream){

			stream.on('command', function(command, data){
				self.handle_incoming_message(command, data);
			});

		});

	},

	load_discovery: function(){

		Discovery.find_clients();
		Discovery.start_service(function(listener){

			listener.on('command', self.handle_incoming_message);

		});

	},

	// expects:
	// data: {
	//   module: 'lock',
	//   method: 'disable', -- optional, otherwise calls module.run()
	//   config: { message: 'hi', ... }
	// }

	load_and_run_module: function(data){

		var loader = ModuleLoader(data.module, data.config, data.upstream_version);

		loader.once('done', function(loaded_module){

			if(!loaded_module){

				console.log("Unable to load module");

			} else if(!data.method || data.method == ''){

				loaded_module.run();

			} else {

				try {

					loaded_module[data.method]();

				} catch(e){

					console.log("Whoops! Seems " + loaded_module.name + " doesnt have that method");
				}

			}

		});

	},

	send_wol_packet: function(data, callback){

		var wol = require('wake_on_lan');

		var mac = data.target_mac.replace('-', ':') // replace just in case

		wol.wake(mac, function(error){

			callback(!error);

		});

	},

	// event should == 'message'
	handle_incoming_message: function(command, data){

		console.log(" -- Received " + command + " command!");

		switch(command) {

			case 'run_module':

				load_and_run_module(data);
				break;

			case 'wake_on_lan':

				send_wol_request(data, function(success){

					if (success) {
						console.log("WOL: Done!");
					} else {
						console.log("WOL: Got error.");
					}

				});

				break;

			case 'run_prey', 'fire':
				self.fire();
				break;

			default:
				log(" !! Message not understood!");

		}

	},

	poke: function(host, callback){

		this.send_command('fire', {}, host, callback);

	},

	send_command: function(command, data, host, callback){

		var message = JSON.stringify({event: command, data: data});

		Discovery.send_message(message, host, function(err, bytes){

			callback(err, bytes);

		});

	}

}

module.exports = Main;
