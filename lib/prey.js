//////////////////////////////////////////
// Prey JS Main Object
// (c) 2011, Fork Ltd.forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var common = require('./prey/common'),
		config = common.config,
		logger = common.logger,
		program = common.program,
		path = require('path'),
		fs = require("fs"),
		util = require("util"),
		System = require('./prey/providers/system'),
		hooks = require('./prey/hook_dispatcher'),
		Connection = require('./prey/connection'),
		Request = require('./prey/request'),
		ResponseParser = require('./prey/response_parser'),
		ModuleLoader = require('./prey/module_loader'),
		ActionsManager = require('./prey/actions_manager'),
		Report = require('./prey/report'),
		Notifier = require('./prey/notifier'),
//	Discovery = require('./discovery'),
		OnDemand = require('./prey/on_demand');

var self;

var Main = {

	running: false,

	log: function(str){
		logger.info(str);
	},

	run: function(){

		self = this;
		process.env.LOOP = 0;

		System.get('logged_user', function(user_name){
			process.env.LOGGED_USER = user_name ? user_name.split("\n")[0] : null;

			self.initialize(function(){
				hooks.trigger('initialized');
				self.engage();
			});

		});

	},

	engage: function(){

		hooks.trigger('loop_start');
		process.env.LOOP++;
		this.modules = {action: [], report: []};
		this.auto_connect_attempts = 0;
		this.check_connection_and_fetch();

	},

	done: function(){

		logger.info("Loop ended!");
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

	initialize_hooks: function(){

		if(!self) self = this;
		this.actions = {}, this.events = {};

		ActionsManager.on('action_returned', function(action_module, success){
			self.actions[action_module.name] = !!success; // object -> true
			// logger.info("Currently running actions: " + ActionsManager.running_actions.length);
		});

		ActionsManager.on('event_triggered', function(trigger_name, data){
			logger.info("Event triggered: " + trigger_name);
			self.events[trigger_name] = data || {};
			if(ActionsManager.waiting_to_return <= 0)
				Main.notify_events();
		});

		ActionsManager.on('all_returned', function(running_actions){
			Main.notify_events();
		});

		// from hook dispatcher
		hooks.on('command', function(command, data){
			Main.handle_incoming_message(command, data);
		});

	},

	initialize: function(callback){

		this.running = true;
		this.running_as = process.env.RUNNING_USER = process.env.USER || process.env.USERNAME || 'System';
		this.started_at = new Date();

		logger.write("\n  PREY " + common.version + " spreads its wings!", 'light_red');
		logger.write("  Current time: " + this.started_at.toString())
		logger.write("  Running on a " + common.os_name + " system as " + this.running_as);
		logger.write("  Detected logged user: " + process.env.LOGGED_USER);
		logger.write("  NodeJS version: " + process.version + "\n");

		this.initialize_hooks();

		if(config.device_key == ""){

			logger.warn("Device key not present.")

			if(config.api_key == ""){

				logger.error("No API key found! Please set up Prey and try again.");
				process.exit(1);

			} else {

				logger.info("Attaching device to your account...");

				require('./prey/register').new_device({api_key: config.api_key}, function(device_key){

					if(device_key){
						config.device_key = device_key;
						common.set_device_constants();
						callback();
					} else {
						// logger.error("Couldn't register this device. Please try again in a sec.");
						process.exit(1);
					}

				});

			}
		} else {
			callback();
		}

	},

	check: function(){

		var Check = require('./prey/check');

		Check.installation();
		if(config.destinations.indexOf('http') != -1)
			Check.http_config();
		if(config.destinations.indexOf('smtp') != -1)
			Check.smtp_config();
	},

	check_connection_and_fetch: function(){

		logger.info("Checking connection...");
		var conn = new Connection(config.proxy);

		conn.once('found', function(){
			logger.info("Connection found!");
			program.check ? self.check() : self.fetch();
		});

		conn.once('not_found', function(){

			logger.notice("No connection found.");
			if(config.auto_connect && self.auto_connect_attempts < config.max_auto_connect_attempts){

				self.auto_connect_attempts++;
				logger.info("Trying to auto connect...");

				common.os.auto_connect(function(success){

					setTimeout(function(){
						self.check_connection_and_fetch();
					}, config.auto_connect_timeout || 5000);

				});

			} else {
				logger.info("Not trying any more.");
				self.no_connection();
			}

		});

	},

	no_connection: function(){

		hooks.trigger('no_connection');

		if(path.existsSync(common.helpers.tempfile_path(config.last_response_file))){
			response_body = fs.readFileSync(config.last_response_file);
			this.process(response_body, true);
		}

		logger.error("No connection available.");
		this.shutdown();

	},

	fetch: function(url){

		logger.info("Fetching instructions...");
		hooks.trigger('fetch_start');

		var urls = url
		? [url]
		: config.alternate_check_urls.concat([common.device.url]);

		var req = new Request(urls, function(body, response){

			hooks.trigger('fetch_end');

			self.response_status = response.statusCode;
			// var content_type = response.headers["content-type"];

			self.process(body, false);

		})

	},
	
	add_default_destinations: function(){

		// mixin selected destinations in config.js 
		config.destinations.forEach(function(dest){
			['data', 'events', 'report'].forEach(function(type){
				if(!self.requested.destinations[type][dest]) self.requested.destinations[type][dest] = true;
			})
		});

	},

	process: function(response_body, offline){

		var parser_options = {key: config.api_key};

		ResponseParser.parse(response_body, parser_options, function(parsed){

			if(!parsed) return false;
			self.requested = parsed;
			self.add_default_destinations();

			self.check_client_version(function(){

				self.process_main_config();

				if(!self.requested.report && !self.requested.actions) {
					logger.info("No report or actions requested.");
					return false;
				}

				if(!offline && self.requested.offline_actions)
					fs.writeFile(config.last_response_file, response_body, function(err){
						if(err) logger.error(err);
						else logger.info("Stored cached version instruction set.");
					});

				if(!self.requested.report || Object.keys(self.requested.report).length == 0) {

					Main.start_actions(self.requested.actions);

				} else {

					Main.gather_report(self.requested.report, function(report){

						if(Object.keys(report.traces).length <= 0){

							logger.info("Nothing to send!");

						} else {

							var options = {
								url: self.requested.post_url
							}

							var notifier = Notifier.send(report.traces, self.requested.destinations.report);

							notifier.once('sent', function(destinations){
								report.empty();
								hooks.trigger('report_sent', report);
							});

						}

						Main.start_actions(self.requested.actions);

					});

				}

				Main.done();


			});

		});

	},

	missing: function(){
		try {
			return this.requested.missing; // from instructions
		} catch(e){
			return this.response_status == config.missing_status_code;
		}
	},

	client_outdated: function(){
		return common.helpers.is_greater_than(this.requested.current_release, common.version);
	},

	check_client_version: function(callback){

		if(this.auto_update && this.client_outdated()){

			this.update_client(function(success){
				if(success) {
					logger.notice("Client updated! Shutting down...");
					process.exit(100);
				} else {
					logger.error("Auto-update failed. Proceeding as normal.");
					callback();
				}
			});

		} else {

			callback();

		}

	},

	process_main_config: function(){

		logger.info("Processing main config...");

		var status_msg = this.missing() ? "HOLY SHMOLY, DEVICE IS MISSING!" : "Device not missing. Sweet.";
		logger.info(status_msg, 'bold');

		if(this.requested.delay) this.update_delay(this.requested.delay);

		if(!this.on_demand && this.requested.on_demand)
			this.initialize_on_demand();

	},

	update_delay: function(requested_delay){

		common.os.get_current_delay(function(current_delay){

			logger.info("Current delay: " + current_delay + ", requested delay: " + requested_delay);

			if(parseInt(current_delay) != parseInt(requested_delay)){

				common.os.set_new_delay(requested_delay, function(success){

					if(success) logger.info("Delay succesfully updated.");
					else logger.error("Unable to set new delay.");

				});
			}

		});

	},

	load_plugins: function(array, callback){

		var requested_modules = array.length || 1;
		var returned_count = 0;
		var loaded_modules = [];
		logger.info("" + requested_modules + " actions enabled!")

		array.forEach(function(requested_module){

			var version_to_pass = (requested_module.version && self.requested.auto_update) ? requested_module.version : null;
			var loader = ModuleLoader.load(requested_module.name, version_to_pass, requested_module.options);

			loader.once('done', function(loaded_module){

				returned_count++;

				if(!loaded_module)
					logger.info("Shoot! Couldn't load module: " + requested_module.name);
				else
					loaded_modules.push(loaded_module);

				if(returned_count >= requested_modules)
					callback(loaded_modules);

			});

		});

	},

	gather_report: function(requested_info, callback){

		hooks.trigger('report_start');
		var report = new Report();

		report.once('ready', function(){

			hooks.trigger('report_ready', report);
			callback(report);

		});

		report.gather(requested_info);

	},

	get_info: function(requested_info){

		if(!this.requested || !this.requested.destinations)
			return logger.error("No destinations for data provided!");

		if(!this.provider)
			this.provider = require('./prey/data_provider');

		this.provider.get_many(requested_info, function(data){
			Notifier.send(data, self.requested.destinations.data);
		});

	},

	start_actions: function(actions_array){

		this.load_plugins(actions_array, function(modules){

			logger.info('All plugins loaded.');
			ActionsManager.initialize(modules);

			hooks.trigger('actions_start');
			ActionsManager.start_all();

		});

	},
	
	stop_actions: function(action_name){
		ActionsManager.stop(data.name);
	},

	notify_events: function(){

		if(Object.keys(this.actions).length > 0 || Object.keys(this.events).length > 0) {

			logger.info("Got new events! Notifying endpoints...", 'bold');

			if(!this.requested || !this.requested.destinations)
				return logger.error("No destinations available to notify.");

			var events = {actions: this.actions, events: this.events};
			var notification = Notifier.send(events, this.requested.destinations.events);

			notification.once('sent', function(destinations){
				hooks.trigger('notification_sent', events);
			});

		}

	},

	on_demand_active: function(){
		return(this.on_demand && this.on_demand.connected);
	},

	initialize_on_demand: function(){

		logger.info('On Demand mode enabled! Trying to connect...');

		var options = {
			host: this.requested.on_demand.host,
			port: this.requested.on_demand.port
		}

		this.on_demand = OnDemand.connect(options, function(stream){

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

	update_client: function(callback){

		callback(false);

		var updater = require('./prey/updater');

		updater.update(function(new_version){

			if(new_version)
				ControlPanel.update_device_info({client_version: new_version});
			else
				logger.info("Update process was unsuccessful.");

		})

	},

	update_config: function(data){

		common.config[data.key] = data.value;
		logger.info("New value set for " + data.key + " -> " + data.value);
		if (data.save){
			common.helpers.store_config_value(data.key, data.value, function(err){
				if(err) logger.error(err);
				else logger.info("Value stored in config!");
			});
		}

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

		logger.info("Received " + command + " command!");

		switch(command) {

			case 'update_delay':
				this.update_delay(data);
				break;

			case 'update_setting':
				this.update_config(data);
				break;

			case 'start_action':
				this.start_actions([data]);
				break;

			case 'stop_action':
				this.stop_action(data.name);
				break;

			case 'get_trace':
				this.get_info([data]);
				break;

			case 'wake':

				wake(data, function(success){

					if (success) {
						console.log("WOL: Done!");
					} else {
						console.log("WOL: Got error.");
					}

				});

				break;

			case 'run_prey', 'engage':
				self.unleash();
				break;

			default:
				logger.info(" !! Message not understood!");

		}

	},

	poke: function(host, callback){

		this.send_command('engage', {}, host, callback);

	},

	send_command: function(command, data, host, callback){

		var message = JSON.stringify({event: command, data: data});

		Discovery.send_message(message, host, function(err, bytes){

			callback(err, bytes);

		});

	}

}

module.exports = Main;
