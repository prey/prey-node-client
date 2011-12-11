//////////////////////////////////////////
// Prey HTTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var user_agent = require('./../common').user_agent,
		util = require('util'),
		http_client = require('needle'),
		Transport = require('../transport');

var HTTPTransport = function(options){

	Transport.call(this, options);
	var self = this;
	this.name = 'http';

	this.url = options.url;

	this.send = function(data){

		this.emit('start');

		var options = this.options;
		var url = this.url;

		options.headers = { "User-Agent" : user_agent };
		options.multipart = true;

		if(this.options.proxy.enabled){
			options.port = this.options.proxy.port;
			options.path = url; // proxy servers require sending the full destination as path
			url = this.options.proxy.host;
		}

		this.log("Posting data to " + this.url);

		http_client.post(url, data, options, function(err, response, body){

			if(err) return self.emit('end', false);

			self.log('Response body: ' + body);
			self.log('Got status code: ' + response.statusCode);

			var success = (response.statusCode == 200);
			self.emit('end', success);

		});

	}

}

util.inherits(HTTPTransport, Transport);

exports.init = function(options){
	var transport = new HTTPTransport(options);
	return transport;
};
