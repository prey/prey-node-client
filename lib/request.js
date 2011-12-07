//////////////////////////////////////////
// Prey Request Class
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		logger = base.logger,
		util = require('util'),
		emitter = require('events').EventEmitter,
		http_client = require('restler'),
		System = require('./providers/system'),
		Network = require('./providers/network');

function Request(config, headers, callback){

	var self = this;
	this.config = config;
	this.headers = headers;
	this.callback = callback;
	this.uris = this.config.check_urls;
	this.attempts = 0;

	this.log = function(str){
		logger.info(" -- [request] " + str);
	}

	this.start = function(){

			var options = { headers: this.headers, parser: false }

			if (this.config.extended_headers) {

				this.extend_headers(options.headers, function(ext_headers){
					options.headers = ext_headers;
					self.get(self.uris[0], options, self.callback)
				});

			} else {

				this.get(this.uris[0], options, this.callback)

			}

	}

	this.extend_headers = function(headers, callback){

		var async_headers = 3;
		var headers_got = 0;

		headers['X-Logged-User'] = process.env["LOGGED_USER"] // logged_user

		self.on('ext_header', function(key){

			if(++headers_got >= async_headers)
				return callback(headers);

		});

		System.get('current_uptime', function(seconds){
			headers['X-Current-Uptime'] = seconds;
			self.emit('ext_header', 'current_uptime');
		});

		System.get('remaining_battery', function(percentage){
			headers['X-Remaining-Battery'] = percentage; // 80
			self.emit('ext_header', 'remaining_battery');
		});

		Network.get('active_access_point', function(essid_name){
			headers['X-Active-Access-Point'] = essid_name || 'None';
			self.emit('ext_header', 'active_access_point');
		});

	},

	this.log_response_time = function(){
		var now = new Date();
		var seconds = (now - this.start_time)/1000;
		this.log("Request took " + seconds.toString() + " seconds.");
	};

	this.valid_status_code = function(code){
		return code == 200 || code == 404;
	};

	this.get = function(url, options, callback){

		if(typeof url == 'undefined') return false;
		var full_url = url + '/devices/' + config.device_key + '.xml';

		this.start_time = new Date();
		this.log("Fetching URI: " + full_url);

		if(config.use_proxy){
			this.log("Connecting through proxy " + config.proxy_host + " at port " + config.proxy_port);
			options.port = config.proxy_port;
			options.path = full_url; // proxy servers require sending the full destination as path
			full_url = config.proxy_host;
		}

		http_client.get(full_url, options)
		.once('complete', function(body, response){

			self.log_response_time();
			self.log('Got status code: ' + response.statusCode);

			if(self.valid_status_code(response.statusCode))
				callback(response, body);

			self.attempts = 0; // reset back to zero
		})
		.once('error', function(body, response){
			// log(' -- Got status code: ' + response.statusCode);
			if(!self.valid_status_code(response.statusCode)){
				self.log("Unexpected status code received: " + response.statusCode);
				self.get(self.uris[++self.attempts], options, callback);
			}
		});

	}

	this.start();

}

util.inherits(Request, emitter);
module.exports = Request;
