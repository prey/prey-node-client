//////////////////////////////////////////
// Prey HTTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../common');
		user_agent = common.user_agent,
		util = require('util'),
		http_client = require('needle'),
		Transport = require('./../../transport');

var HTTPTransport = function(options){

	Transport.call(this, options);
	var self = this;
	this.name = 'http';

	this.send = function(data){

		this.emit('start');

		var options = this.options;
		var url = options.url;
		var method = options.method || 'post';

		var request_opts = {
			headers: { "User-Agent" : user_agent },
			multipart: true,
			username: options.username,
			password: options.password
		}
		
		if (common.config.proxy.enabled)
			request_opts.proxy = 'http://' + options.proxy.host + ':' + options.proxy.port;

		var host = url.replace(/.*\/\/([^\/]+).*/, "$1");
		this.log("Posting data to " + host);

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

exports.send = function(data, options){
	var transport = new HTTPTransport(options);
	transport.send(data);
	return transport;
}
