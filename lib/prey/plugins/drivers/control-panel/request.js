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
	this.uris = urls;
	this.options = options;
	this.callback = callback;
	this.last_error;

	this.log = function(str){
		logger.info("[request] " + str);
	}

	this.got_error = function(err){
		this.last_error = err;
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
				self.fetch(0, options);
			});

		} else {

			this.fetch(0, options);

		}

	}

	// other types of information that may be useful to know:
	// cpu usage, ram usage, hdd usage, total running programs ?
	this.append_status_report = function(headers, cb){

		var headerize = function(str){
			return str.replace(/_/g, '-').replace(/(^|\-)\w/g, function($0) { return $0.toUpperCase(); })
		}

		require('./../../../providers').get('status', function(err, data){
			if(err) return cb(headers);

			for(key in data){
				var key_header = 'X-Prey-' + headerize(key);
				headers[key_header] = data[key];
			}

			cb(headers);
		})

	},

	this.log_response_time = function(){
		var now = new Date();
		var seconds = (now - this.start_time)/1000;
		this.log("Request took " + seconds.toString() + " seconds.");
	};

	this.valid_status_code = function(code){
		return code == 200 || code == 201 || code == 404;
	};

	this.fetch = function(attempt, options){

		var url = this.uris[attempt];

		if(typeof url == 'undefined') {

			if (config.get('try_proxy')){ // reset attempts and try again
				options.proxy = config.get('proxy_url');
				this.log("Connecting via proxy: " + options.proxy)
				this.fetch(0, options);
			} else {
				return this.callback(this.last_error);
			}

		}

		this.start_time = new Date();
		var host = url.replace(/.*\/\/([^\/]+).*/, "$1");
		this.log("Fetching URI from " + host + "...");

		http_client.get(url, options, function(err, resp, body){

			self.log_response_time();

			if(err){

				self.got_error(err);
				self.fetch(attempt+1, options);

			} else if(!self.valid_status_code(resp.statusCode)){

				logger.error("Got unexpected status code: " + resp.statusCode);
				self.got_error(new Error(body));
				self.fetch(attempt+1, options);

			} else {

				self.log('Got status code: ' + resp.statusCode);
				self.callback(null, resp, body);

			}

		});

	}

	this.start();

}

util.inherits(Request, emitter);
module.exports = Request;
