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
		System = require('./plugins/providers/system'),
		hooks = require('./hooks'),
		connection = require('./connection'),
		plugins = require('./plugin_loader'),
		actions = require('./actions_manager');

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
			? common.helpers.random_between(1, 59) : 0;

		setTimeout(function(){

			System.get('logged_user', function(user_name){
				process.env.LOGGED_USER = user_name ? user_name.split("\n")[0] : null;

				self.initialize(function(){
					hooks.trigger('initialized');
					self.engage();
				});

			});

		}, start_wait_time * 1000);

	},

	engage: function(trigger){

		if(trigger == 'SIGUSR1')
			logger.info("Triggered by interval!")
		else if(trigger == 'SIGUSR2')
			logger.info("Triggered by network!")

		hooks.trigger('loop_start');
		process.env.LOOP++;
		this.auto_connect_attempts = 0;
		
		if(!this.driver)
			this.load_driver(program.driver || config.driver);
	
		if(!program.connection_found)
			this.check_connection();
	
		hooks.trigger('loop_end');

		// this.check_active_hooks();
	
	},

/*
	check_active_hooks: function(){

		logger.info("Active hooks: " + hooks.active.length);

		if(hooks.active.length > 0){
			this.timer = setInterval(function(){
				logger.info("Active hooks: " + hooks.active.length);
				if(hooks.active.length <= 0) clearInterval(self.timer);
			}, 5 * 1000); // 5 seconds
		}

	},

*/

	shutdown: function(){

		if(!this.running) return;

		hooks.trigger('shutdown');
		self.unload_drivers();
		actions.stop_all();
		this.running = false;

	},

	initialize: function(callback){

		this.running = true;
		this.running_as = process.env.RUNNING_USER = process.env.USER || process.env.USERNAME || 'System';
		this.started_at = new Date();

		logger.write("\n  PREY " + common.version + " spreads its wings!", 'light_red');
		logger.write("  Current time: " + this.started_at.toString(), 'bold')
		logger.write("  Running with PID " + process.pid + " on a " + common.os_name + " system as " + this.running_as);
		logger.write("  Detected logged user: " + process.env.LOGGED_USER);
		logger.write("  NodeJS version: " + process.version + "\n");

		if(common.program.actions) 
			self.start_actions_by_name(common.program.actions.split(','));

		callback();

	},
	
	check_connection: function(attempt){

		connection.check(config.proxy, function(err){

			if(!err){

				program.connection_found = true;
				hooks.trigger('connection_found');
	
			} else if(self.auto_connect_attempts++ < config.auto_connect_attempts){

				logger.info("Trying to auto connect...");

				common.os.auto_connect(function(success){

					setTimeout(function(){
						self.check_connection();
					}, config.auto_connect_timeout || 5000);

				});

			} else {

				logger.notice("No connection found. " + err.toString());
				hooks.trigger('no_connection');

			}

		});

	},

	load_driver: function(driver_name, driver_options){
		
		logger.info("Loading " + driver_name + " driver...");
		var driver_name = driver_name || 'control_panel';

		plugins.load_driver(driver_name, driver_options, null, function(loaded_driver){
			
			if(!loaded_driver) return logger.error("Unable to load driver " + driver_name);
			self.setup_driver(loaded_driver);

		});

	},
	
	setup_driver: function(driver){

		this.drivers[driver.name] = driver;

		driver.on('actions' , self.start_actions); // command_name, options
		driver.on('delay'   , self.update_delay); // new_delay
		driver.on('driver'  , self.load_driver); // driver_name, driver_options
		driver.on('get_info', self.get_data);
		driver.on('setting' , self.update_setting); // key, value
		driver.on('settings', self.update_settings); // key, value
		driver.on('start_action', self.start_action_by_name); 
		driver.on('stop_action',  self.stop_action);
		driver.on('update'  , self.check_client_version); // current_release

		driver.load(driver.config);
	
	},
	
	unload_driver: function(driver_name){
		logger.info("Unloading " + driver_name + " driver...")
		this.drivers[driver_name].unload();
	},
	
	unload_drivers: function(){
		for(driver_name in this.drivers)
			this.unload_driver(driver_name);
	},

	client_outdated: function(current_release){
		return common.helpers.is_greater_than(current_release, common.version);
	},

	check_client_version: function(current_release, callback){
		
		if(!current_release)
			return logger.error("Cannot update without a requested version");

		if(self.client_outdated(current_release)){

			self.shutdown();

			self.update_client(function(success){
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
			common.helpers.store_main_config_value(key, value, function(err){
				if(err) logger.error(err);
				else logger.notice("Value stored!");
			})
		} 
		common.config[key] = value;

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
			this.provider = require('./provider_hub');
			
		var method = (typeof requested_data == 'object') ? 'get_many' : 'get';

		this.provider[method](requested_data, function(name, data){
			if(data) self.send_data(requested_data, data);
			else logger.error("Unable to get " + requested_data);
		});

	},

	send_data: function(context, data){
	
		if(!data || (typeof data == 'object' && Object.keys(data).length <= 0))
			return logger.notice("No data to send!");
		
		hooks.emit('data', context, data);

	},

	load_action_hooks: function(){

		actions.on('action_returned', function(action_name, success, data){
			hooks.trigger('event', action_name + '_returned', success);
			if(data) self.send_data(action_name, data);
		});

		actions.on('action_finished', function(action_name, success, data){
			hooks.trigger('event', action_name + '_finished', success);
			if(data) self.send_data(action_name, data);			
		});

		// triggered when all actions return through callback, 
		// whether or not some of them may be still running
		actions.on('all_returned', function(running_actions){
			hooks.trigger('event', 'all_actions_returned', running_actions);
		});

		actions.on('event_triggered', function(trigger_name, data){
			logger.notice("Event triggered: " + trigger_name);
			hooks.trigger('event', trigger_name, data);
			if(data) self.send_data(trigger_name, data);
		});
		
		this.action_hooks_loaded = true;

	},

	start_actions: function(actions_array){

		actions.load_and_start(actions_array);

		if(!self.action_hooks_loaded)
			self.load_action_hooks();

	},
	
	start_actions_by_name: function(action_name){
		var list = [];
		list.forEach(function(name){
			list.push({name: name});
		})
		self.start_actions(list);
	},
	
	start_action_by_name: function(action_name, options){
		self.start_actions([{name: action_name, options: options}])
	},
	
	stop_action: function(action_name){
		actions.stop(action_name);
	}

}

module.exports = Agent;