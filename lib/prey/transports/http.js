//////////////////////////////////////////
// Prey HTTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		http_client = require('needle'),
		Transport = require('../transport');

var HTTPTransport = function(options){

	Transport.call(this, options);
	var self = this;
	this.name = 'http';

	this.url = options.url;

	this.flatten_data = function(object){

		var data = {};
		for(key in object){

			var obj = object[key];
			for(k in obj){

				var val = obj[k];
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

			}

		};

		return data;
	}

	this.send = function(data){

		this.emit('start');

		this.options.headers = { "User-Agent" : this.options.user_agent };
		this.options.data = this.flatten_data(data);

		if(this.contains_files)
			this.options.multipart = true;

		if(this.options.proxy.enabled){
			this.options.port = this.options.proxy.port;
			this.options.path = this.url; // proxy servers require sending the full destination as path
			this.url = this.options.proxy.host;
		}

		http_client.post(this.url, this.options, function(err, response, body){

			var success = (!err && response.statusCode == 200);

			self.log(' -- Got status code: ' + response.statusCode);
			self.log(' -- ' + body);
			self.emit('end', success);

		});

	}

}

util.inherits(HTTPTransport, Transport);

exports.init = function(options){
	var transport = new HTTPTransport(options);
	return transport;
};
