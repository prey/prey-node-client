//////////////////////////////////////////
// Prey Request Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		http_client = require('restler'),
		Session = require(base.modules_path + '/session'),
		Geo = require(base.modules_path + '/geo'),
		Network = require(base.modules_path + '/network');

function Request(config, headers, callback){

	var self = this;
	this.config = config;
	this.headers = headers;
	this.callback = callback;
	this.uris = this.config.check_urls;
	this.attempts = 0;

	this.log = function(str){

		console.log(" -- [request] " + str);

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

		self.on('async_header', function(key){

			headers_got++;
			if(headers_got >= async_headers){
				callback(headers);
			}

		});

		Session.get('current_uptime', function(seconds){
			headers['X-Current-Uptime'] = seconds;
			self.emit('async_header', 'current_uptime');
		});

		Network.get('active_access_point', function(essid_name){
			headers['X-Active-Access-Point'] = essid_name || 'None';
			self.emit('async_header', 'active_access_point');
		});

		Geo.get('coords_via_wifi', function(coords){
			headers['X-Current-Lat'] = coords ? coords.lat : 0;
			headers['X-Current-Lng'] = coords ? coords.lat : 0;
			self.emit('async_header', 'coords_via_wifi');
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
