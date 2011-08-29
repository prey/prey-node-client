var util = require('util'),
		sys = require('sys'),
		emitter = require('events').EventEmitter,
		http_client = require('restler'),
		Session = require(modules_path + '/session'),
		Geo = require(modules_path + '/geo'),
		Network = require(modules_path + '/network');

function Request(callback){

	var self = this;

	this.start = function(callback){

		var uri = config.check_url + '/devices/' + config.device_key + '.xml';
		console.log(' -- Fetching URI: ' + uri);

		var options = { headers: { "User-Agent": user_agent } }

		if (config.extended_headers) {

			this.extend_headers(options.headers, function(ext_headers){
				options.headers = ext_headers;
				self.get(uri, options, callback)
			});

		} else {

			self.get(uri, options, callback)

		}

	}

	this.extend_headers = function(headers, callback){

		var async_headers = 3;
		var headers_got = 0;

		headers['X-Logged-User'] = logged_user // logged_user

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

	this.get = function(uri, options, callback){

		http_client.get(uri, options)
		.once('complete', function(body, response){
			log(' -- Got status code: ' + response.statusCode);
			callback(response, body);
		})
		.once('error', function(body, response){
			log(' -- Got status code: ' + response.statusCode);
		});

	}

	this.start(callback);

}

sys.inherits(Request, emitter);
module.exports = Request;
