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
		var method = options.method || 'post';

		var request_opts = {
			headers: { "User-Agent" : user_agent },
			multipart: true,
			username: options.username,
			password: options.password
		}
		
		if (options.proxy.enabled)
			request_opts.proxy = 'http://' + options.proxy.host + ':' + options.proxy.port;

		this.log("Posting data to " + this.url);

		http_client[method](url, data, request_opts, function(err, response, body){

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
