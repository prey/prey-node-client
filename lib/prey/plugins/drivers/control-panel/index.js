
var common = require('./../../../common'),
		logger = common.logger,
		util = require('util'),
		path = require('path'),
		Request = require('./request'),
		dispatcher = require('./../../../dispatcher'),
		hooks = require('./../../../hooks'),
		parser = require('./response_parser'),
		emitter = require('events').EventEmitter;

var ControlPanelDriver = function(options){
	
	var self = this;
	this.name = 'control-panel';
	this.events = {};
	this.config = options;

	this.load = function(){
		
		this.cached_response_file = common.helpers.tempfile_path(this.config.cached_response_filename);
		
		this.check_keys(function(err){
			
			if(err) {
				
				logger.error(err);
	
				if(process.env.TERM && process.env.TERM != 'dumb')
					return self.run_setup();

				this.unload();

			}

			logger.info("Control Panel keys are in place. Proceeding...")
			self.set_urls();

			if(common.program.connection_found){

				self.fetch();
	
			} else {

				hooks.once('no_connection', function(){
					self.check_cached_response();
				});

				hooks.once('connection_found', function(){
					self.fetch();
				});

			}

		});

	};
	
	this.unload = function(){
		this.removeAllListeners();
	};
	
	this.set_urls = function(){
		
		this.urls = {
			'device': 'http://' + this.config.host + '/devices/' + this.config.device_key + '.xml',
			'events': 'http://' + this.config.host + '/devices/' + this.config.device_key + '/events.xml',
			'report': 'http://' + this.config.host + '/devices/' + this.config.device_key + '/reports.xml'
		}
		
	}
	
	this.fetch = function(){

		// var urls = config.alternate_check_urls.concat([common.device.url]);
		var urls = [this.urls.device];
		
		var req = new Request(urls, function(body, response){
			
			self.response_status = response.statusCode;
			self.process(body, false);
			
		});
		
		
	};

	this.check_cached_response = function(){

		path.exists(this.cached_response_file, function(exists){
			if(exists) {
				logger.notice("Cached response file found! Processing...")
				self.process(fs.readFileSync(self.cached_response_file, 'utf8'), true);
			}
		});
		
		// this.shutdown();

	};

	this.marked_as_missing = function(){
		try {
			return this.requested.missing; // from instructions
		} catch(e){
			return this.response_status == this.config.missing_status_code; // config.missing_status_code;
		}
	},

	this.process = function(response_body, offline){

		parser.parse(response_body, {key: this.config.api_key}, function(parsed){

			if(!parsed) return false;
			
			self.requested = parsed;

			if(!offline && self.requested.offline_actions){
				fs.writeFile(cached_response_file_path, response_body, function(err){
					if(err) logger.error(err);
					else logger.info("Stored cached version instruction set.");
				});
			}

			try{
				var report_url = parsed.endpoints.report.control_panel.url;
				self.urls.report = report_url;
			} catch(e){ }

			self.emit_requested();
			self.load_hooks();
		
		});

	};
	
	this.send = function(key, data){

		var options = {
			url: this.urls[key], 
			username: this.config.api_key, 
			password: 'x'
		};

		dispatcher.send('http', data, options, function(err, response_body){
			if(err) logger.error(err);
		});

	};

	this.load_hooks = function(){
		
		hooks.on('event', function(name, data){
			if(name == 'all_actions_returned')
				self.send('events', self.events);
			else if(data)
				self.events[name] = data;
		});
		
		hooks.on('data', function(name, data){
			// console.log("Got data from " + name);
			self.send(name, data);
		});
		
	};

	this.emit_requested = function(){

		logger.info("Processing requested instructions...");

		// var status_msg = this.marked_as_missing() ? "HOLY SHMOLY, DEVICE IS MISSING!" : "Device not missing. Sweet.";
		// logger.info(status_msg, 'bold');

		if(this.requested.version && this.requested.auto_update)
			this.emit('version', this.requested.version);

		if(this.requested.delay && this.requested.delay > 0) 
			this.emit('delay', this.marked_as_missing() ? this.requested.delay : 0);
			
		if(this.requested.settings && Object.keys(this.requested.settings).length > 0)
			this.emit('settings', this.requested.settings);
			// this.update_settings(this.requested.settings);
		
		if(this.requested.actions && Object.keys(this.requested.actions).length > 0)
			this.emit('actions', this.requested.actions);

		for(driver in this.requested.drivers)
			this.emit('driver', driver, this.requested.drivers[driver])

		// for(context in this.requested.endpoints)
			// this.emit('endpoint', context, this.requested.endpoints[context])

	};
	
	this.check_keys = function(callback){

		if(this.config.device_key == ""){

			logger.warn("Device key not present.")

			if(this.config.api_key == ""){

				callback(new Error("No API key found."))

			} else {

				this.register_device(callback);

			}

		} else {

			callback();

		}

	};
	
	this.register_device = function(callback){

		logger.info("Attaching device to your account...");
		require('./register').new_device({api_key: this.config.api_key}, function(err, data){

			if(err || !data.device_key){
				
				callback(err || new Error("Couldn't register this device. Please try again in a sec."));
				
			} else {

				common.helpers.store_config_value(['drivers', self.name], 'device_key', data.device_key, function(err){
					if(err) throw(err);
					self.config.device_key = data.device_key;
					callback();
				})

			}

		});

	};
	
	this.run_setup = function(){

		setTimeout(function(){ 
	
			require('./setup').run(function(err, data){
	
				if(err) throw(err);
				
				common.helpers.store_config_value(['drivers', self.name], 'api_key', data.api_key, function(err){
					if(err) throw(err);
					self.config.api_key = data.api_key;
					self.load();
				})

			}) 
		}, 500);
	}
	
}

util.inherits(ControlPanelDriver, emitter);

var instance;

exports.load = function(options, callback){
	instance = new ControlPanelDriver(options);
	try{
		instance.load();
		callback(null, instance);
	} catch(e){
		callback(e);
	}
}

exports.unload = function(){
	instance.unload();
}