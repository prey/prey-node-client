//////////////////////////////////////////
// Prey Request Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		sys = require('sys'),
		emitter = require('events').EventEmitter,
		http_client = require('restler'),
		Session = require(base.modules_path + '/session'),
		Geo = require(base.modules_path + '/geo'),
		Network = require(base.modules_path + '/network');

function Request(config, headers, callback){

	var self = this;

	this.start = function(config, headers, callback){

			var options = { headers: headers, parser: false }

			if (config.extended_headers) {

				this.extend_headers(options.headers, function(ext_headers){
					options.headers = ext_headers;
					self.get(config.check_urls, options, callback)
				});

			} else {

				self.get(config.check_urls, options, callback)

			}

	}

	this.extend_headers = function(headers, callback){

		var async_headers = 3;
		var headers_got = 0;

		headers['X-Logged-User'] = process.env["LOGGED_USER"] // logged_user

		self.on('async_header', function(key){

			// console.log('got header ' + key);

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
		console.log(" -- Request took " + seconds.toString() + " seconds.");
	};

	this.valid_status_code = function(code){
		return code == 200 || code == 404;
	};

	this.get = function(uris, options, callback){

		if(uris.length == 0) return false;

		var uri = uris.shift();
		var full_url = uri + '/devices/' + config.device_key + '.xml';

		this.start_time = new Date();
		console.log(" -- Fetching URI: " + full_url);

		if(config.use_proxy){
			console.log(" -- Connecting through proxy " + config.proxy_host + " at port " + config.proxy_port);
			options.port = config.proxy_port;
			options.path = full_url; // proxy servers require sending the full destination as path
			full_url = config.proxy_host;
		}

		http_client.get(full_url, options)
		.once('complete', function(body, response){
			self.log_response_time();
			log(' -- Got status code: ' + response.statusCode);
			if(self.valid_status_code(response.statusCode)){
				callback(response, body);
			}
		})
		.once('error', function(body, response){
			// log(' -- Got status code: ' + response.statusCode);
			if(!self.valid_status_code(response.statusCode)){
				log(" -- Unexpected status code received: " + response.statusCode)
				self.get(uris, options, callback);
			}
		});

	}

	this.start(config, headers, callback);

}

sys.inherits(Request, emitter);
module.exports = Request;
