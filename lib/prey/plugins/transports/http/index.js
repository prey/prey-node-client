//////////////////////////////////////////
// Prey HTTP Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common');
		user_agent = common.user_agent,
		util = require('util'),
		http_client = require('needle'),
		Transport = require('./../../../transport');

var HTTPTransport = function(options){

	Transport.call(this, options);
	var self = this;
	this.name = 'http';

	this.options = options;
	this.url = options.url;
	this.method = options.method || 'post';

	this.send = function(data, callback){

		this.emit('start');

		var request_opts = {
			headers: { "User-Agent" : user_agent },
			multipart: true,
			timeout: 20000,
			username: this.options.username,
			password: this.options.password
		}

		if (common.config && common.config.proxy.enabled)
			request_opts.proxy = 'http://' + common.config.proxy.host + ':' + common.config.proxy.port;

		var host = this.url.replace(/.*\/\/([^\/]+).*/, "$1");
		this.log("Posting data to " + host);

		http_client[this.method](this.url, data, request_opts, function(err, response, body){

			if(!err){
				self.log('Response body: ' + body);
				self.log('Got status code: ' + response.statusCode);
			}

			callback(err, body);
			self.emit('end', err, data);

		});

	}

}

util.inherits(HTTPTransport, Transport);

exports.send = function(data, options, callback){
	var transport = new HTTPTransport(options);
	transport.send(data, callback);
}
