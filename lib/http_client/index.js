//////////////////////////////////////////
// Node HTTP Client
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		http = require('http'),
		url = require('url'),
		util = require('util'),
		query_string = require('./querystring-stringify'),
		base64_encode = require('./node-base64/base64').encode;

var HTTPClient = function(uri, method, options, data, callback){

	this.perform = function(){

		var remote = url.parse(uri);
		var https = remote.protocol === "https:"
		var port = remote.port || (https ? 443 : 80);

		var headers = {
			"Host" : remote.host,
			"User-Agent": "NodeHTTP/1.0 (NodeJS " + process.version + ")",
			"Connection": "close",
			"Accept": "*/*"
		}

		for(h in options.headers)
			if(headers.hasOwnProperty(h)) headers[h] = options.headers[h];

		if(data) {
			var post_data = (typeof(data) === "object") ? query_string.stringify(data) : data;
			headers['Content-Length'] = post_data.length.toString();
			headers['Content-Type'] = "application/x-www-form-urlencoded"
		}

		// console.log(util.inspect(post_data));

		if(options.user && options.pass)
			headers['Authorization'] = "Basic " + this.auth_encode(options.user + ":" + options.pass)

		var http_client = http.createClient(port, remote.host);
		http_client.setTimeout(5000);
		var request = http_client.request(method, remote.pathname, headers);
		request.end(post_data);

		request.on('response', function(response) {

			response.setEncoding('utf8');
			// console.log(response.statusCode)
			// console.log(response.headers)

			response.on('data', function(body){
				callback(response, body);
			});


		});

	}

	this.auth_encode = function(string){
		var Buffer = require('buffer').Buffer;
		return base64_encode(new Buffer(string));
	}

	this.perform();

}

// sys.inherits(HTTPClient, events.EventEmitter);

exports.get = function(uri, options, callback){
	return new HTTPClient(uri, "GET", options, false, callback);
}

exports.post = function(uri, data, options, callback){
	return new HTTPClient(uri, "POST", options, data, callback);
}

exports.put = function(uri, data, options, callback){
	return new HTTPClient(uri, "POST", options, data, callback);
}

exports.delete = function(uri, data, options, callback){
	return new HTTPClient(uri, "DELETE", options, false, callback);
}
