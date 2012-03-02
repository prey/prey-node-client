//////////////////////////////////////////
// Prey Request Class
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		config = common.config,
		logger = common.logger,
		util = require('util'),
		emitter = require('events').EventEmitter,
		http_client = require('needle');

function Request(urls, options, callback){

	var self = this;
	this.callback = callback;
	this.uris = urls;
	this.options = options;

	this.attempts = 0;

	this.log = function(str){
		logger.info("[request] " + str);
	}

	this.start = function(){

		var options = { 
			parse: false, 
			headers: { 
				'User-Agent': common.user_agent,
				'X-Encrypt-Response': 'aes-128-cbc'
			}
		}

		if (this.options && this.options.report_status) {

			this.append_status_report(options.headers, function(headers){
				options.headers = headers;
				self.fetch(self.uris[0], options, self.callback)
			});

		} else {

			this.fetch(this.uris[0], options, this.callback)

		}

	}

	// other types of information that may be useful to know:
	// cpu usage, ram usage, hdd usage, total running programs ?
	this.append_status_report = function(headers, callback){
		
		var headerize = function(str){
			return str.replace(/_/g, '-').replace(/(^|\-)\w/g, function($0) { return $0.toUpperCase(); })
		}

		require('./../../../provider_hub').get('status', function(err, data){

			if(err) return callback(headers);
			
			for(key in data){
				var key_header = 'X-' + headerize(key);
				headers[key_header] = data[key];
			}
			
			callback(headers);
			
		})


	},

	this.log_response_time = function(){
		var now = new Date();
		var seconds = (now - this.start_time)/1000;
		this.log("Request took " + seconds.toString() + " seconds.");
	};

	this.valid_status_code = function(code){
		return code == 200 || code == 404;
	};

	this.fetch = function(url, options, callback){

		if(typeof url == 'undefined') return false;

		this.start_time = new Date();
		var host = url.replace(/.*\/\/([^\/]+).*/, "$1");
		this.log("Fetching URI from " + host + "...");

		// TODO: fix this
		if(config && config.proxy && config.proxy.enabled){
			this.log("Connecting through proxy " + config.proxy_host + " at port " + config.proxy_port);
			options.proxy = 'http://' + config.proxy.host + ':' + config.proxy.port;
		}

		http_client.get(url, options, function(err, response, body){

			self.log_response_time();

			if(err){

				logger.error(err);
				self.fetch(self.uris[++self.attempts], options, callback);

			} else if(!self.valid_status_code(response.statusCode)){

				logger.error("Got unexpected status code: " + response.statusCode);
				self.fetch(self.uris[++self.attempts], options, callback);

			} else {

				self.log('Got status code: ' + response.statusCode);
				self.attempts = 0; // reset back to zero
				callback(body, response);

			}

		});

	}

	this.start();

}

util.inherits(Request, emitter);
module.exports = Request;
