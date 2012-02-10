
var common = require('./../../../common'),
		util = require('util'),
		Request = require('./request'),
		hooks = require('./../../../hook_dispatcher'),
		parser = require('./response_parser'),
		emitter = require('events').EventEmitter;

var config = common.config.drivers.control_panel,
		host = 'control.preyproject.com',
		missing_status_code = 404,
		cached_response_file_path = common.helpers.tempfile_path('last_response.xml');

var ControlPanelDriver = function(){
	
	var self = this;
	this.events = {};

	this.load = function(options){
		
		this.check_keys(function(){
			
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
	}
	
	this.set_urls = function(){

		this.urls = {
			'device': 'http://' + host + '/devices/' + config.device_key + '.xml',
			'events': 'http://' + host + '/devices/' + config.device_key + '/events.xml',
			'report': 'http://' + host + '/devices/' + config.device_key + '/reports.xml'
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

		path.exists(cached_response_file_path, function(exists){
			if(exists) {
				logger.notice("Cached response file found! Processing...")
				self.process(fs.readFileSync(last_response_file_path, 'utf8'), true);
			}
		});
		
		// this.shutdown();

	};

	this.marked_as_missing = function(){
		try {
			return this.requested.missing; // from instructions
		} catch(e){
			return this.response_status == missing_status_code; // config.missing_status_code;
		}
	},

	this.process = function(response_body, offline){

		parser.parse(response_body, {key: config.api_key}, function(parsed){

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

		if(!this.transport) this.transport = require('./../../transports/http');
		
		var options = {
			url: this.urls[key], 
			username: config.api_key, 
			password: 'x'
		}
		
		this.transport.send(data, options);
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

		if(config.device_key == ""){

			logger.warn("Device key not present.")

			if(config.api_key == ""){

				logger.error("No API key found! Please set up Prey and try again.");
				require('./setup')

			} else {

				logger.info("Attaching device to your account...");
				require('./register').new_device({api_key: config.api_key}, function(device_key){

					if(device_key){
						config.device_key = device_key;
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

	}
	
}

util.inherits(ControlPanelDriver, emitter);
module.exports = new ControlPanelDriver();