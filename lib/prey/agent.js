//////////////////////////////////////////
// Prey JS Main Object
// (c) 2011, Fork Ltd.forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var common = require('./common'),
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

	run: function(){

		if(this.running) return false;
	
		self = this;
		process.env.LOOP = 0;

		// if we're being run though cron, wait a few seconds before actually calling engage()
		var start_wait_time = (!process.env.TERM || process.env.TERM == 'dumb') 
			? common.helpers.random_between(1, 59) : 0;

		setTimeout(function(){

			System.get('logged_user', function(err, user_name){
				process.env.LOGGED_USER = user_name ? user_name.split("\n")[0] : null;

				self.prepare_for_engage();

			});

		}, start_wait_time * 1000);

		if(start_wait_time > 0) 
			logger.debug('[agent] Sleeping for ' + start_wait_time.toString() + ' seconds...');

	},
	
	prepare_for_engage: function(){

		this.initialize(function(){

			hooks.trigger('initialized');

			// only check for updates if enabled and run via trigger (usually on startup)
			if(!common.config.auto_update || !process.env.TRIGGER)
				return self.engage();

			self.check_for_update(function(err, new_version){

				if(err) self.log_error(err);
				if(!new_version) return self.engage();

				logger.notice("Updated to version " + new_version + "! Shutting down...")
				self.shutdown();

			});

		});

	},

	engage: function(trigger){
		
		if(trigger){
			hooks.trigger('trigger', trigger);
			logger.info("Triggered by " + trigger)
		}

		hooks.trigger('loop_start');
		process.env.LOOP++;

		this.auto_connect_attempts = 0;

		if(Object.keys(this.drivers).length === 0)
			this.load_driver(program.driver || common.config.driver);
	
		if(!program.connection_found)
			this.check_connection();
	
		hooks.trigger('loop_end');
	
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

		if(program.actions) 
			this.start_actions_by_name(program.actions.split(','));

		callback();

	},
	
	check_connection: function(attempt){
		
		var options = common.config.proxy.enabled ? common.config.proxy : {};

		connection.check(options, function(err){

			if(!err){

				program.connection_found = true;
				hooks.trigger('connection_found');
	
			} else if(self.auto_connect_attempts++ < config.auto_connect_attempts){

				logger.notice("[agent] Trying to auto connect...");

				common.os.auto_connect(function(success){

					setTimeout(function(){
						self.check_connection();
					}, config.auto_connect_timeout || 5000);

				});

			} else {

				logger.notice("[agent] No connection found. " + err.toString());
				hooks.trigger('no_connection');

			}

		});

	},
	
	log_error: function(err){
		logger.error("[agent] " + err.toString());
		logger.debug(err.stack);
		// hooks.emit('error', message);
	},

	load_driver: function(driver_name, driver_options){
		
		var driver_name = driver_name || 'control_panel';
		plugins.load_driver(driver_name, function(err, driver_module){
			
			if(err) return self.log_error(err);
			self.setup_driver(driver_module, driver_options || driver_module.config);

		});

	},
	
	setup_driver: function(driver_module, options){

		logger.info("[agent] Initializing " + driver_module.name + " driver...");
		
		driver_module.load(options, function(err, driver){

			if(err) return self.log_error(err);

			// driver.on('delay'   , self.update_delay); // new_delay
			driver.on('driver'  , self.load_driver); // driver_name, driver_options
			driver.on('get', self.get_data);
			driver.on('set' , self.update_setting); // key, value

			// actions
			driver.on('actions' , self.start_actions); // array of actions
			driver.on('start', self.start_action_by_name); // action_name, options
			driver.on('stop',  self.stop_action); // action_name

		});

		this.drivers[driver_module.name] = driver_module;

	},
	
	unload_driver: function(driver_name){
		logger.info("[agent] Unloading " + driver_name + " driver...")
		this.drivers[driver_name].unload();
	},
	
	unload_drivers: function(){
		for(driver_name in this.drivers)
			this.unload_driver(driver_name);
	},

	check_for_update: function(callback){
		
		logger.info("Checking for updates...");
		var updater = require('./updater');
		
		updater.get_latest_version(function(err, version){
			
			if(err) return callback(err);
			if(!version) return callback(new Error("Unable to retrieve client version"));
	
			if(!common.helpers.is_greater_than(version, common.version))
				return callback();
			
			this.log("New version found! " + version);
			hooks.trigger('event', 'new_version', version);
			updater.update_client(version, callback);
			
		})

	},

	update_settings: function(hash){		
		for(key in hash)
			this.update_setting(key, hash[key]);
	},

	update_setting: function(key, value){
		
		if(key == 'delay')
			return this.update_delay(value);

		logger.info("Setting new value for " + key + ": " + value);

		if(common.config.hasOwnProperty(key)){
			common.helpers.store_main_config_value(key, value, function(err){
				if(err) self.log_error(err);
				else logger.notice("Value stored!");
			})
		} 

		common.config[key] = value;

	},

	update_delay: function(requested_delay){
		
		var set_new_delay = function(delay){

			common.os.set_new_delay(delay, function(err){
				if(err) self.log_error("Unable to set new delay.");
				else logger.info("[agent] Delay succesfully set.");
			});

		}

		common.os.get_current_delay(function(current_delay){
			
			if(!current_delay.value)
				logger.warn("[agent] No delay found! Are you running as the right user?")
			else
				logger.debug("[agent] Current delay: " + current_delay.value + ", requested: " + requested_delay);
	
			// if we get a valid integer (eg. device marked as missing)
			// set the execution delay to every X minutes
			if(current_delay.value > 0){
				
				// if new delay is different to current one, change
				if(parseInt(current_delay.value) != parseInt(requested_delay))
					set_new_delay(requested_delay);

			// if device is not missing, then make sure it is set to a random minute every one hour
			} else if(parseInt(current_delay.value) == NaN || !current_delay.one_hour){

				set_new_delay(60);

			}

		});

	},

	get_data: function(requested_data){

		if(!this.provider)
			this.provider = require('./provider_hub');
			
		var method = (typeof requested_data == 'object') ? 'get_many' : 'get_one';

		this.provider[method](requested_data, function(err, data){
			if(err) return self.log_error(err);			
			if(data) self.send_data(requested_data, data);
		});

	},

	send_data: function(context, data){
	
		if(!data || (typeof data == 'object' && Object.keys(data).length <= 0))
			return logger.notice("No data to send!");
		
		hooks.trigger('data', context, data);

	},

	load_action_hooks: function(){

		actions.on('action_running', function(action_name){
			hooks.trigger('event', action_name + '_running');
		});
		
		actions.on('action_finished', function(action_name, err, data){
			hooks.trigger('event', action_name + '_finished', err);
			if(err) self.log_error(err);
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

		if(!self.action_hooks_loaded)
			self.load_action_hooks();

		actions.load_and_start(actions_array);

	},
	
	start_actions_by_name: function(list){
		var actions = [];
		list.forEach(function(name){
			actions.push({name: name});
		})
		self.start_actions(actions);
	},
	
	start_action_by_name: function(action_name, options){
		self.start_actions([{name: action_name, options: options}])
	},
	
	stop_action: function(action_name){
		actions.stop(action_name);
	},

	shutdown: function(){

		if(!this.running) return;

		hooks.trigger('shutdown');
		this.unload_drivers();
		actions.stop_all();
		this.running = false;

	}

}

module.exports = Agent;