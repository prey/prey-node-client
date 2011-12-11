//////////////////////////////////////////
// Prey JS Main Object
// (c) 2011, Fork Ltd.forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var common = require('./prey/common'),
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

	run: function(config){

		self = this;
		this.config = config;
		process.env.LOOP = 0;

		System.get('logged_user', function(user_name){
			process.env.LOGGED_USER = user_name ? user_name.split("\n")[0] : null;

			self.initialize(function(){
				hooks.trigger('initialized');
				self.unleash();
			});

		});

	},

	unleash: function(){

		hooks.trigger('loop_start');
		process.env.LOOP++;
		this.modules = {action: [], report: []};
		this.auto_connect_attempts = 0;

		this.check_connection_and_fetch();

	},

	done: function(){

		logger.info("Loop ended!");
		hooks.trigger('loop_end');

		hooks.on('command', function(command, data){
			Main.handle_incoming_message(command, data);
		});

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

	initialize_action_hooks: function(){

		this.actions = {}, this.events = {};

		ActionsManager.on('action_returned', function(action_module, success){
			self.actions[action_module.name] = !!success; // object -> true
			logger.info("Currently running actions: " + ActionsManager.running_actions.length);
		});

		ActionsManager.on('event_triggered', function(trigger_name, data){
			logger.info("Event triggered: " + trigger_name);
			self.events[trigger_name] = data || {};
			if(ActionsManager.waiting_to_return() <= 0)
				Main.notify_events();
		});

		ActionsManager.on('all_returned', function(running_actions){
			Main.notify_events();
		});

	},

	initialize: function(callback){

		this.running = true;
		this.running_user = process.env['USERNAME'];
		this.started_at = new Date();

		logger.write("\n  PREY " + common.version + " spreads its wings!", 'light_red');
		logger.write("  Current time: " + this.started_at.toString())
		logger.write("  Running on a " + common.os_name + " system as " + this.running_user);
		logger.write("  Detected logged user: " + process.env["LOGGED_USER"]);
		logger.write("  NodeJS version: " + process.version + "\n");

		this.initialize_action_hooks();

		if(this.config.device_key == ""){

			logger.warn("Device key not present.")

			if(this.config.api_key == ""){

				logger.error("No API key found! Please set up Prey and try again.");
				process.exit(1);

			} else {

				logger.info("Attaching device to your account...");

				require('./prey/register').new_device({}, function(device_key){

					if(device_key){
						self.config.device_key = device_key;
						callback();
					} else {
						logger.error("Couldn't finish the auto-setup routine. Please try again in a sec.");
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
		if(this.config.post_methods.indexOf('http') != -1)
			Check.http_config();
		if(this.config.post_methods.indexOf('smtp') != -1)
			Check.smtp_config();
	},

	check_connection_and_fetch: function(){

		logger.info("Checking connection...");
		var conn = new Connection(this.config.proxy);

		conn.once('found', function(){
			logger.info("Connection found!");
			program.check ? self.check() : self.fetch()
		});

		conn.once('not_found', function(){

			logger.notice("No connection found.");
			if(self.config.auto_connect && self.auto_connect_attempts < self.config.max_auto_connect_attempts){

				self.auto_connect_attempts++;
				logger.info("Trying to auto connect...");

				common.os.auto_connect(function(success){

					setTimeout(function(){
						self.check_connection_and_fetch();
					}, self.config.auto_connect_timeout || 5000);

				});

			} else {
				logger.info("Not trying any more.");
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

		logger.critical("No connection available.");
		this.shutdown();

	},

	fetch: function(){

		logger.info("Fetching instructions...")
		hooks.trigger('fetch_start');

		var req = new Request(this.config.check_urls, function(body, response){

			hooks.trigger('fetch_end');

			self.response_status = response.statusCode;
			var content_type = response.headers["content-type"];

			self.process(body, content_type, false);

		})

	},

	process: function(response_body, content_type, offline){

		var parser_options = {type: content_type, key: this.config.api_key};

		ResponseParser.parse(response_body, parser_options, function(parsed){

			self.requested = parsed;
			self.process_main_config();

			if(!self.requested.report || !self.requested.actions) {
				logger.info("No report or actions requested.");
				return false;
			}

			if(!offline && self.requested.offline_actions)
				common.helpers.save_file_contents(this.config.last_response_file, response_body);

			if(!self.missing()) {

				Main.start_actions(self.requested.actions);

			} else {

				Main.gather_report(self.requested.report, function(report){

					if(Object.keys(report.traces).length <= 0){

						logger.info("Nothing to send!");

					} else {

						var options = {
							url: self.requested.post_url
						}

						var notifier = Notifier.send(report.traces, options);

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

	},

	missing: function(){
		try {
			return self.requested.missing; // from instructions
		} catch(e){
			return self.response_status == this.config.missing_status_code;
		}
	},

	process_main_config: function(){

		logger.info("Processing main config...")

		var status_msg = this.missing() ? "HOLY SHENANIGANS, DEVICE IS MISSING!" : "Device not missing. Sweet.";
		logger.info("" + status_msg, 'bold');

		this.update_delay(self.requested.delay);

		if(!this.on_demand && this.requested.on_demand)
			this.initialize_on_demand();

	},

	update_delay: function(requested_delay){

		common.os.check_current_delay(common.script_path, function(current_delay){
			logger.info("Current delay: " + current_delay + ", requested delay: " + requested_delay);
			if(parseInt(current_delay) != parseInt(requested_delay)){
				logger.info("Setting new delay!")
				os.set_new_delay(requested_delay, common.script_path);
			}
		});

	},

	load_modules: function(array, callback){

		var requested_modules = array.length || 1;
		var returned_count = 0;
		var loaded_modules = [];
		logger.info("" + requested_modules + " modules enabled!")

		array.forEach(function(requested_module){

			var version_to_pass = self.requested.auto_update ? requested_module.version : null;

			var loader = ModuleLoader.load(requested_module.name, version_to_pass, requested_module.config);

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

	get_info: function(traces){

		this.provider |= require('./data_provider');

		provider.get_many(traces, function(data){
			Notifier.send(data);
		});

	},

	start_actions: function(actions_array){

		self.load_modules(actions_array, function(modules){

			logger.info('All modules loaded.');

			ActionsManager.initialize(modules);

			hooks.trigger('actions_start');
			ActionsManager.start_all();

		});

	},

	notify_events: function(){

		if(Object.keys(this.actions).length > 0 || Object.keys(this.events).length > 0) {

			logger.info("Got new events! Notifying endpoints...");

			var data = {actions: this.actions, events: this.events};
			var notification = Notifier.send(data);

			notification.once('sent', function(destinations){
				hooks.trigger('notification_sent', data);
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

	update_client: function(){

		var updater = require('./core/updater');

		updater.update(function(new_version){

			if(new_version)
				ControlPanel.update_device_info({client_version: new_version});
			else
				logger.info("Update process was unsuccessful.");

		})

	},

	update_config: function(){

		// TODO

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

			case 'update_config':
				this.update_config(data);
				break;

			case 'start_action':

				this.start_actions([data]);
				break;

			case 'stop_action':
				ActionsManager.stop(data.name);

			case 'get_info':
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

			case 'run_prey', 'unleash':
				self.unleash();
				break;

			default:
				logger.info(" !! Message not understood!");

		}

	},

	poke: function(host, callback){

		this.send_command('unleash', {}, host, callback);

	},

	send_command: function(command, data, host, callback){

		var message = JSON.stringify({event: command, data: data});

		Discovery.send_message(message, host, function(err, bytes){

			callback(err, bytes);

		});

	}

}

module.exports = Main;
