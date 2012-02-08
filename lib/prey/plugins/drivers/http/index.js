
var common = require('./../../../common'),
		config = common.config,
		util = require('util'),
		Request = require('./request'),
		hooks = require('./../../../hook_dispatcher'),
		parser = require('./response_parser'),
		emitter = require('events').EventEmitter;

var cached_response_file_path = config.last_response_file;

var HTTPDriver = function(){
	
	var self = this;

	this.load = function(options){
		if(common.program.connection_found){
			this.fetch()
		} else{
			
			hooks.once('no_connection', function(){
				self.check_cached_response()
			});
	
			hooks.once('connection_found', function(){
				self.fetch()
			});
		}
	};
	
	this.unload = function(){
		this.removeAllListeners();
	}
	
	this.fetch = function(){

		var urls = config.alternate_check_urls.concat([common.device.url]);
		
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
			return this.response_status == 404; // config.missing_status_code;
		}
	},

	this.process = function(response_body, offline){

		var parser_options = {key: config.api_key};

		parser.parse(response_body, parser_options, function(parsed){

			if(!parsed) return false;
			
			self.requested = parsed;
			// self.set_default_destinations();

			if(!offline && self.requested.offline_actions){
				fs.writeFile(cached_response_file_path, response_body, function(err){
					if(err) logger.error(err);
					else logger.info("Stored cached version instruction set.");
				});
			}

			self.emit_requested();
		
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

		for(endpoint in this.requested.endpoints)
			this.emit('endpoint', endpoint, this.requested.endpoints[endpoint])

	};
	
}

util.inherits(HTTPDriver, emitter);
module.exports = new HTTPDriver();