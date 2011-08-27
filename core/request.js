var util = require('util'),
		sys = require('sys'),
		emitter = require('events').EventEmitter,
		http_client = require(base_path + '/vendor/restler'),
		Session = require(modules_path + '/session'),
		Geo = require(modules_path + '/geo'),
		Network = require(modules_path + '/network');

function Request(callback){

	var self = this;

	this.start = function(callback){

		var uri = config.check_url + '/devices/' + config.device_key + '.xml';

		var options = { headers: { "User-Agent": user_agent } }

		if (config.extended_headers) {

			this.get_extended_headers(options.headers, function(ext_headers){
				options.headers = ext_headers;
				self.get(uri, options, callback)
			});

		} else {

			this.get(uri, options, callback)

		}

	}

	this.get_extended_headers = function(headers, callback){

		var async_headers = 3;
		var headers_got = 0;

		headers['X-Logged-User'] = process.env['USERNAME'] // logged_user

		self.on('async_header', function(){

			headers_got++;
			if(headers_got >= async_headers){
				callback(headers);
			}

		});

		Session.get('current_uptime', function(seconds){
			headers['X-Current-Uptime'] = seconds;
			self.emit('async_header');
		});

		Network.get('active_access_point', function(essid_name){
			headers['X-Active-Access-Point'] = essid_name || 'None';
			self.emit('async_header');
		});

		Geo.get('coords_via_wifi', function(coords){
			headers['X-Current-Lat'] = coords ? coords.lat : 0;
			headers['X-Current-Lng'] = coords ? coords.lat : 0;
			self.emit('async_header');
		});

	},

	this.get = function(uri, options, callback){

		// console.log(options.headers)

		http_client.get(uri, options)
		.once('complete', function(body, response){
			log(' -- Got status code: ' + response.statusCode);
			callback(response, body);
		})
		.once('error', function(body, response){
			// log(' -- Got status code: ' + response.statusCode);
		});

	}

	this.start(callback);

}

sys.inherits(Request, emitter);
module.exports = Request;
