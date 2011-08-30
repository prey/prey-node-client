//////////////////////////////////////////
// Prey HTTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		http_client = require('restler'),
		Transport = require('../core/transport');

var HTTPTransport = function(report, options){

	Transport.call(this, report, options);
	var self = this;
	this.destination = 'http';

	this.post_url = report.options.post_url;

	this.flatten_data = function(object){
		var data = {};
		object.forEach(function(obj, key){
				obj.forEach(function(val, k){
					var f = key + '[' + k + ']';
					if(val instanceof String) {
						data[f] = val;
					} else {
						if (val.path){
							self.contains_files = true;
							data[f] = http_client.file(val.path, {content_type: val.type});
						} else if (val != false) {
							data[f] = JSON.stringify(val);
						}
					}
				});
		});
		return data;
	}

	this.send = function(data){

		log(" -- Sending report via HTTP...");
		this.emit('start');

		this.options.headers = { "User-Agent" : user_agent },
		this.options.data = this.flatten_data(data);

		if(this.contains_files)
			this.options.multipart = true;

		http_client.post(this.post_url, this.options)
		.once('complete', function(body, response){
			console.log(' -- Got status code: ' + response.statusCode);
			console.log(' -- ' + body);
			self.emit('end');
		})
		.once('error', function(body, response){
			// console.log(' -- Got status code: ' + response.statusCode);
		});

	}

}

sys.inherits(HTTPTransport, Transport);
module.exports = HTTPTransport;
