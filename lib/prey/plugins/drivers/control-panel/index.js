
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

	this.log = function(str){
		logger.info("[driver] " + str);
	};

	this.load = function(){
		
		this.cached_response_file = common.helpers.tempfile_path(this.config.cached_response_filename);
		
		this.check_keys(function(err){
			
			if(err) {

				logger.error(err);

				if(process.env.TERM && process.env.TERM != 'dumb')
					return self.run_setup();

				this.unload();

			}

			self.log("Control Panel keys are in place. Proceeding...")
			self.set_urls();
			self.load_hooks();

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

	this.load_hooks = function(){
		
		hooks.on('event', function(name, data){
			if(name == 'all_actions_returned')
				self.send_events();
			else if(data)
				self.events[name] = data;
		});
		
		hooks.on('data', function(name, data){
			// console.log("Got data from " + name);
			self.send(name, data);
		});
		
		hooks.on('trigger', function(trigger_type){
			self.fetch();
		});
		
	};

	this.unload = function(err){
		if(err) logger.error(err);
		this.removeAllListeners();
	};
	
	this.set_urls = function(){
		
		var base_url = 'http://' + this.config.host + '/devices/' + this.config.device_key;
		var request_format = '.xml';
		
		this.endpoints = {
			device: {
				url: base_url + request_format,
				method: 'put'
			},
			events: {
				url: base_url + '/events' + request_format,
				method: 'put'
			},
			location: {
				url: base_url + '/reports' + request_format,
				method: 'post'
			}
		}

		this.endpoints.specs = this.endpoints.device;
		
	}
	
	this.fetch = function(){

		// var urls = config.alternate_check_urls.concat([common.device.url]);
		var urls = [this.endpoints.device.url];
		
		var req = new Request(urls, this.config, function(body, response){
			
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

	this.marked_as_missing = function(requested){
		try {
			return requested.missing; // from instructions
		} catch(e) {
			return this.response_status == this.config.missing_status_code; // config.missing_status_code;
		}
	},

	this.process = function(response_body, offline){

		parser.parse(response_body, {key: this.config.api_key}, function(err, requested){

			if(err) return logger.error(err);
			else if(!requested) return logger.error("Got empty instruction set!");

			if(!offline && requested.offline_actions){
				fs.writeFile(cached_response_file_path, response_body, function(err){
					if(err) logger.error(err);
					else self.log("Stored cached version instruction set.");
				});
			}


			try{
				var report_url = requested.endpoints.report.control_panel.url;
				self.endpoints.location.url = report_url;
			} catch(e){ }

			self.emit_requested(requested);
		
		});

	};
	
	this.send = function(key, data){

		if(Object.keys(data) == 0) return; 
		logger.info("Sending " + key + " data...");
		// console.log(JSON.stringify(data, null, 2))

		var options = {
			url: this.endpoints[key].url,
			method: this.endpoints[key].method, 
			username: this.config.api_key, 
			password: 'x'
		};

		dispatcher.send('http', data, options, function(err, response_body){
			if(err) logger.error(err);
		});

	};
	
	this.send_events = function(){
		this.send('events', {events: this.events});
		this.events = {};
	}

	this.emit_requested = function(requested){

		this.log("Processing requested instructions");

		// var status_msg = this.marked_as_missing() ? "HOLY SHMOLY, DEVICE IS MISSING!" : "Device not missing. Sweet.";
		// logger.info(status_msg, 'bold');

		// if device is missing, set delay to requested delay, otherwise every 60 minutes
		// if(requested.delay && parseInt(requested.delay) > 0) 
			// this.emit('set', 'delay', this.marked_as_missing(requested) ? requested.delay : 60)

		// if(requested.settings && Object.keys(requested.settings).length > 0)
		for(setting in requested.settings)
			this.emit('set', setting, requested.settings[setting])

		for(info in requested.info)
			this.emit('get', info, requested.info[info]);

		if(requested.actions && Object.keys(requested.actions).length > 0)
			this.emit('actions', requested.actions);

		for(driver in requested.drivers)
			this.emit('driver', driver, requested.drivers[driver])

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

				logger.info("Device succesfully created. Key: " + data.device_key);

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