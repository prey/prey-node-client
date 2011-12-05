//////////////////////////////////////////
// Prey JS Main Object
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var base = require('./base'),
		logger = base.logger,
		path = require('path'),
		fs = require("fs"),
		util = require("util"),
		hooks = require('./hook_dispatcher'),
		Check = require('./check'),
		Connection = require('./connection'),
		Request = require('./request'),
		ResponseParser = require('./response_parser'),
		Setup = require('./setup'),
		ModuleLoader = require('./module_loader'),
		ActionsManager = require('./actions_manager'),
		Report = require('./report'),
		Notifier = require('./notifier'),
//	Discovery = require('./discovery'),
		OnDemand = require('./on_demand');

var self;

var Main = {

	running: false,

	log: function(str){
		logger.info(str);
	},

	run: function(config, args, version){

		self = this;
		this.config = config;
		this.args = args;
		this.version = version;
		process.env.LOOP = 0;

		base.helpers.run_cmd(base.os.get_logged_user_cmd, function(user_name){
			process.env.LOGGED_USER = user_name.split("\n")[0];

			self.initialize(function(){
				hooks.trigger('initialized');
				self.fire();
			});

		});

	},

	fire: function(){

		hooks.trigger('loop_start');
		process.env.LOOP++;
		this.modules = {action: [], report: []};
		this.auto_connect_attempts = 0;

		this.check_connection_and_fetch();

	},

	done: function(){

		logger.info(" -- Loop ended!");
		hooks.trigger('loop_end');

		logger.info("Active hooks: " + hooks.active.length);

		if(hooks.active.length > 0){
			this.timer = setInterval(function(){
				logger.info("Active hooks: " + hooks.active.length);
				if(hooks.active.length <= 0) clearInterval(self.timer);
			}, 5 * 1000); // 5 seconds
		}

		// if(!Discovery.running) this.load_discovery();

	},

	shutdown: function(){

		hooks.trigger('shutdown');
		if(OnDemand.connected) OnDemand.disconnect();
		ActionsManager.stop_all();
		if(this.discovery_service) Discovery.stop_service();
		this.running = false;

	},

	initialize: function(callback){

		this.running = true;
		this.running_user = process.env['USERNAME'];
		this.started_at = new Date();

		console.log("\n");
		logger.info("  PREY " + base.version + " spreads its wings!\n");
		logger.info("  Current time: " + this.started_at.toString())
		logger.info("  Running on a " + base.os_name + " system as " + this.running_user);
		logger.info("  Detected logged user: " + process.env["LOGGED_USER"]);
		logger.info("  NodeJS version: " + process.version + "\n");

		if(this.config.device_key == ""){

			logger.info(" -- No device key found.")

			if(this.config.api_key == ""){

				logger.info("No API key found! Please set up Prey and try again.");
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

		logger.info(" -- Checking connection...");
		var conn = new Connection(this.config.proxy);

		conn.on('found', function(){
			logger.info(" -- Connection found!");
			self.args.get('check') ? self.check() : self.fetch()
		});

		conn.on('not_found', function(){

			logger.info(" !! No connection found.");
			if(this.config.auto_connect && self.auto_connect_attempts < this.config.max_auto_connect_attempts){

				self.auto_connect_attempts++;
				logger.info(" -- Trying to auto connect...");

				os.auto_connect(setTimeout(function(){
					self.check_connection_and_fetch();
					}, 5000)
				);

			} else {
				logger.info(" -- Not trying any more.");
				self.no_connection();
			}

		});

	},

	no_connection: function(){

		hooks.trigger('no_connection');

		if(path.existsSync(tempfile_path(this.config.last_response_file))){
			response_body = fs.readFileSync(this.config.last_response_file);
			this.process(response_body, true);
		}

		quit("No connection available.")
	},

	fetch: function(){

		logger.info(" -- Fetching instructions...")
		hooks.trigger('fetch_start');

		var headers = { "User-Agent": this.user_agent };

		var req = new Request(this.config, headers, function(response, body){

			hooks.trigger('fetch_end');

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
				logger.info(" -- No report or actions requested.");
				return false;
			}

			if(!offline && self.requested.configuration.offline_actions)
				base.helpers.save_file_contents(this.config.last_response_file, response_body);

			self.process_module_config(self.requested.modules, function(modules){

				logger.info(' -- All modules loaded.');
				hooks.trigger('modules_loaded', modules);

				ActionsManager.initialize(modules.action);

				if(self.missing() && modules.report.length > 0) {

					Main.gather_report(modules.report, function(report){

						if(Object.keys(report.traces).length <= 0){

							logger.info(" -- Nothing to send!");

						} else {

							var options = {
								user_agent: self.user_agent,
								url: self.config.post_url
							}

							var notifier = Notifier.send(report.traces, options);

							notifier.once('sent', function(){
								report.empty();
								hooks.trigger('report_sent');
							});

						}

						Main.start_actions();

					});

				} else {

					Main.start_actions();

				}

				Main.done();

			});

		});

	},

	missing: function(){
		try {
			return self.requested.status.missing; // from instructions
		} catch(e){
			return self.response_status == this.config.missing_status_code;
		}
	},

	process_main_config: function(){

		logger.info(" -- Processing main config...")
		//debug(self.requested);

		if(typeof(this.config.auto_update) == 'boolean')
			self.auto_update = this.config.auto_update;
		else
			self.auto_update = self.requested.configuration.auto_update || false;

		var status_msg = self.missing() ? "Device is missing!" : "Device not missing. Sweet.";
		logger.info(" -- " + status_msg);

		self.process_delay();

		if(!self.on_demand && self.requested.configuration.on_demand_mode)
			self.setup_on_demand();

	},

	process_delay: function(){

		var requested_delay = self.requested.configuration.delay;

		base.os.check_current_delay(base.script_path, function(current_delay){
			logger.info("Current delay: " + current_delay + ", requested delay: " + requested_delay);
			if(parseInt(current_delay) != parseInt(requested_delay)){
				logger.info(" -- Setting new delay!")
				os.set_new_delay(requested_delay, base.script_path);
			}
		});

	},

	process_module_config: function(data, callback){

		var requested_modules = data.module.length || 1;
		var modules_loaded = 0;
		logger.info(" -- " + requested_modules + " modules enabled!")

		for(id in data.module){

			var module_config = data.module[id];

			if(typeof(module_config) !== "object") continue;
//			console.log(util.inspect(module_config));

			var module_data = module_config['@'] || module_config;
			if(!module_data) continue;

			logger.info(" -- Got instructions for " + module_data.type + " module " + module_data.name);

			delete module_config['@'];

			var version_to_pass = self.auto_update ? module_data.version : null;

			var modules = {report: [], action: []};
			var loader = ModuleLoader.load(module_data.name, version_to_pass, module_config);

			loader.once('done', function(prey_module){

				modules_loaded++;

				if(prey_module){

					if(prey_module.type == 'report')
						modules.report.push(prey_module);
					else
						modules.action.push(prey_module);

				}

				if(modules_loaded >= requested_modules) {
					callback(modules);
				}

			});

		}

	},

	gather_report: function(selected_modules, callback){

		hooks.trigger('report_start');
		var report = new Report(selected_modules);

		report.once('ready', function(){

			hooks.trigger('report_ready', report);
			callback(report);

		});

		report.gather();

	},

	start_actions: function(){

		hooks.trigger('actions_start');
		ActionsManager.start_all();
		ActionsManager.once('all_returned', function(running_actions){
			hooks.trigger('actions_end');
			logger.info("Currently running actions: " + running_actions.length);
		});

	},

	on_demand_active: function(){
		return(this.on_demand && this.on_demand.connected);
	},

	setup_on_demand: function(){

		logger.info(' -- On Demand mode enabled! Trying to connect...', 'bold');
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

	load_and_start_action: function(module_data){

		var loader = ModuleLoader.load(module_data.name, module_data.upstream_version);

		loader.once('done', function(loaded_module){

			if(!loaded_module){

				console.log("Unable to load module");

			} else {

				ActionsManager.initialize_module(loaded_module, module_data.config);

				if(module_data.method && module_data.method != ''){

					try {

						loaded_module[module_data.method]();

					} catch(e){

						console.log("Whoopsy! Seems " + module_data.name + " doesnt have that method");

					}

				} else if(loaded_module.start) {

					loaded_module.start(function(success){
						var msg = success ? "Great success!" : "No success. Bummer.";
						console.log(msg);
					});

				} else {

					console.log("Nothing else to do for this one.")

				}

			}

		});

	},

	update_client: function(){

		var updater = require('./core/updater');

		updater.update(function(new_version){

			if(new_version)
				ControlPanel.update_device_info({client_version: new_version});
			else
				logger.info("Update process was unsuccessful.");

		})

	},

	wake: function(data, callback){

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

			case 'start_reports':
				// TODO
				break;

			case 'stop_reports':
				// TODO
				break;

			case 'run_action':

				this.load_and_start_action(data);
				break;

			case 'get_info':


			case 'wake':

				wake(data, function(success){

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
				logger.info(" !! Message not understood!");

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
