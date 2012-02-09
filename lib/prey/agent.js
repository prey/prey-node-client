//////////////////////////////////////////
// Prey JS Main Object
// (c) 2011, Fork Ltd.forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var common = require('./common'),
		config = common.config,
		logger = common.logger,
		program = common.program,
		path = require('path'),
		fs = require("fs"),
		util = require("util"),
		System = require('./plugins/providers/system'),
		hooks = require('./hook_dispatcher'),
		Connection = require('./connection'),
		PluginLoader = require('./plugin_loader'),
		ActionsManager = require('./actions_manager'),
//	Report = require('./report'),
		Notifier = require('./notifier');
//	Discovery = require('./discovery');

var self;

var Agent = {

	running: false,
	drivers: {},
	transports: {},

	run: function(){

		self = this;
		process.env.LOOP = 0;

		// if we're being run though cron, wait a few seconds before actually calling engage()
		var start_wait_time = (!process.env.TERM || process.env.TERM == 'dumb') 
			? common.helpers.random_between(1, 59) 
			: 0;

		setTimeout(function(){

			System.get('logged_user', function(user_name){
				process.env.LOGGED_USER = user_name ? user_name.split("\n")[0] : null;

				self.initialize(function(){
					hooks.trigger('initialized');
					if(common.program.load) 
						self.start_actions_by_name(common.program.load.split(','));
					self.engage();
				});

			});

		}, start_wait_time * 1000);

	},

	engage: function(){

		hooks.trigger('loop_start');
		process.env.LOOP++;
		this.auto_connect_attempts = 0;
		this.load_driver(config.driver);
	
		if(!program.connection_found)
			this.check_connection();
	
	},

	done: function(){

		logger.info("Loop ended!");
		hooks.trigger('loop_end');
		this.check_active_hooks();

		// if(!Discovery.running) this.load_discovery();

	},
	
	check_active_hooks: function(){

		logger.info("Active hooks: " + hooks.active.length);

		if(hooks.active.length > 0){
			this.timer = setInterval(function(){
				logger.info("Active hooks: " + hooks.active.length);
				if(hooks.active.length <= 0) clearInterval(self.timer);
			}, 5 * 1000); // 5 seconds
		}

	},

	shutdown: function(){

		hooks.trigger('shutdown');
		this.unload_drivers();
		ActionsManager.stop_all();
		if(this.discovery_service) Discovery.stop_service();
		this.running = false;

	},

	initialize_hooks: function(){

		this.events = {};

		ActionsManager.on('action_returned', function(action_name, success, data){
			self.events[action_name + "_returned"] = !!success // object -> true
			if(data) self.send_data(action_name, data);
			// logger.info("Currently running actions: " + ActionsManager.running_actions.length);
		});

		ActionsManager.on('action_finished', function(action_name, success, data){
			self.events[action_name + "_finished"] = !!success // object -> true
			if(data) self.send_data(action_name, data);			
		});

		// triggered when all actions return through callback, 
		// whether or not some of them may be still running
		ActionsManager.on('all_returned', function(running_actions){
			self.send_events();
		});

		ActionsManager.on('event_triggered', function(trigger_name, data){
			logger.info("Event triggered: " + trigger_name);
			self.events[trigger_name] = data || {};
			if(ActionsManager.waiting_to_return <= 0) 
				self.send_events();
		});

		// from hook dispatcher
		// hooks.on('command', function(command, data){
		// 	Main.handle_incoming_message(command, data);
		// });

	},
	
	should_skip_config_check: function(){
		return (config.device_key == '' && config.api_key == '' && config.alternate_check_urls != []);
	},

	initialize: function(callback){

		this.running = true;
		this.running_as = process.env.RUNNING_USER = process.env.USER || process.env.USERNAME || 'System';
		this.started_at = new Date();

		logger.write("\n  PREY " + common.version + " spreads its wings!", 'light_red');
		logger.write("  Current time: " + this.started_at.toString(), 'bold')
		logger.write("  Running on a " + common.os_name + " system as " + this.running_as);
		logger.write("  Detected logged user: " + process.env.LOGGED_USER);
		logger.write("  NodeJS version: " + process.version + "\n");

		this.initialize_hooks();

		if(this.should_skip_config_check())
			callback();
		else
			this.check_config(callback);

	},
	
	check_config: function(callback){

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

	check_connection: function(){

		logger.info("Checking connection...");
		var conn = new Connection(config.proxy);

		conn.once('found', function(){
			logger.info("Connection found!");
			hooks.trigger('connection_found');
			program.connection_found = true;
		});

		conn.once('not_found', function(){

			logger.notice("No connection found.");
			if(self.auto_connect_attempts < config.auto_connect_attempts){

				self.auto_connect_attempts++;
				logger.info("Trying to auto connect...");

				common.os.auto_connect(function(success){

					setTimeout(function(){
						self.check_connection();
					}, config.auto_connect_timeout || 5000);

				});

			} else {
				logger.notice("Not trying any more.");
				return hooks.trigger('no_connection');
			}

		});

	},

	load_driver: function(driver_name, driver_options){

		logger.info("Loading " + driver_name + " driver...");
		var driver_name = driver_name || 'control_panel';

		PluginLoader.load_driver(driver_name, driver_options, null, function(driver){
			
			if(!driver) return logger.error("Unable to load driver " + driver_name);

			self.drivers[driver_name] = driver;

			driver.on('actions',  self.start_actions); // command_name, options
			driver.on('command',  self.handle_incoming_command); // command_name, options
			driver.on('delay',    self.update_delay); // new_delay
			driver.on('driver',   self.load_driver); // driver_name, driver_options
			driver.on('endpoint', self.load_transport);
			driver.on('setting',  self.update_setting); // key, value
			driver.on('settings', self.update_settings); // key, value
			driver.on('version',  self.check_client_version); // current_release

			driver.load(driver_options);
			self.done();

		})

	},
	
	unload_driver: function(driver_name){
		logger.info("Unloading " + driver_name + " driver...")
		this.drivers[driver_name].unload();
	},
	
	unload_drivers: function(){
		for(driver in this.drivers)
			this.unload_driver(driver);
	},
	
	load_transport: function(context, endpoint_options){
		
		if(!self.transports[context]) self.transports[context] = [];
		
		for(endpoint_name in endpoint_options){
			
			var options = endpoint_options[endpoint_name];
		
			PluginLoader.load_transport(endpoint_name, options, null, function(loaded_transport){
			
				if(loaded_transport)
					self.transports[context].push(loaded_transport);
				else
					logger.error("Unable to load transport " + endpoint_name + " for context " + endpoint_name);
			
			})
		
		}
		
	},

	client_outdated: function(current_release){
		return common.helpers.is_greater_than(current_release, common.version);
	},

	check_client_version: function(current_release, callback){

		if(this.client_outdated(current_release)){

			self.shutdown();

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

	update_delay: function(requested_delay){
		
		var set_new_delay = function(delay){
			common.os.set_new_delay(delay, function(err){

				if(err) logger.error("Unable to set new delay.");
				else logger.info("Delay succesfully updated.");

			});
		}

		common.os.get_current_delay(function(current_delay){

			logger.info("Current delay: " + current_delay.value + ", requested: " + requested_delay);
	
			// if we get a valid integer (eg. device marked as missing)
			// set the execution delay to every X minutes
			if(current_delay.value > 0){
				
				// if new delay is different to current one, change
				if(current_delay.value != parseInt(requested_delay))
					set_new_delay(requested_delay);

			// if device is not missing, then make sure it is set to a random minute every one hour
			} else if(current_delay.value == NaN || !current_delay.one_hour){

				set_new_delay(60);

			}

		});

	},

	get_data: function(requested_data){

		// if(!this.requested || !this.requested.destinations)
			// return logger.error("No destinations for data provided!");

		if(!this.provider)
			this.provider = require('./prey/provider_hub');

		this.provider.get_many(requested_data, function(data){
			Notifier.send(data);
		});

	},

	send_data: function(context, data){
	
		if(Object.keys(data).length <= 0)
			return logger.notice("No data to send!");

		// if self.transports[context] is null, notifier will fall back to default transports.
		var delivery = Notifier.send(data, self.transports[context]);

		delivery.once('sent', function(destinations){
			hooks.trigger(context + '_sent', data);
			common.helpers.remove_files(data);
		});

	},
	
	send_events: function(){
		this.send_data('events', this.events);
		this.events = {};
	},

	load_actions: function(array, callback){

		var requested_modules = array.length || 1;
		var loaded_modules = [];

		logger.info(requested_modules.toString() + " actions enabled!")

		array.forEach(function(requested_module){

			var version_to_pass = (requested_module.version && config.auto_update) ? requested_module.version : null;			

			PluginLoader.load_action(requested_module.name, requested_module.options, version_to_pass, 
				function(loaded_module){

					if(!loaded_module)
						logger.info("Shoot! Couldn't load module: " + requested_module.name);
					else
						loaded_modules.push(loaded_module);

						--requested_modules || callback(loaded_modules);

			});

		});

	},

	start_actions: function(actions_array){

		Agent.load_actions(actions_array, function(modules){

			logger.info('All plugins loaded.');
			ActionsManager.initialize(modules);

			hooks.trigger('actions_start');
			ActionsManager.start_all();

		});

	},
	
	start_actions_by_name: function(list){
		var array = [];
		list.forEach(function(name){
			array.push({name: name})
		});
		this.start_actions(array);
	},
	
	stop_action: function(action_name){
		ActionsManager.stop(action_name);
	},


	load_discovery: function(){

		Discovery.find_clients();
		Discovery.start_service(function(listener){

			listener.on('command', self.handle_incoming_message);

		});

	},

	update_client: function(callback){

		var updater = require('./prey/updater');

		updater.update(function(new_version){

			if(new_version)
				ControlPanel.update_device_info({client_version: new_version});
			else
				logger.notice("Update process was unsuccessful.");

			callback(!!new_version);

		})

	},

	update_settings: function(hash){		
		for(key in hash)
			this.update_setting(key, hash[key]);
	},

	update_setting: function(key, value){

		logger.info("Setting new value for " + key + ": " + value);

		if(common.config.hasOwnProperty(key)){
			common.helpers.store_config_value(key, value, function(err){
				if(err) logger.error(err);
				else logger.notice("Value stored!");
			})
		} 
		common.config[key] = value;

	},

	wake: function(data, callback){

		var wol = require('wake_on_lan');
		var mac = data.target_mac.replace('-', ':') // replace just in case

		wol.wake(mac, function(error){

			logger.info(!error ? "Great success!" : "No success.")
			if(callback) callback(error);

		});

	},

	// event should == 'message'
	handle_incoming_command: function(command, data){

		logger.info("Received " + command + " command!");

		switch(command) {

/*
			case 'update_delay':
				this.update_delay(data);
				break;

			case 'update_setting':
				this.update_setting(data);
				break;

*/

			case 'start_action':
				this.start_actions([data]);
				break;

			case 'stop_action':
				this.stop_action(data.name);
				break;

			case 'get_data':
				this.get_info([data]);
				break;

			case 'wake':
				this.wake(data);
				break;

			case 'run_prey', 'engage':
				this.engage();
				break;

			default:
				logger.error("Incoming message not understood!");

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

module.exports = Agent;