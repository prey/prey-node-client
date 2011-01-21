//////////////////////////////////////////
// Prey HTTP Client
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////


var sys = require('sys'),
		http = require('http'),
		url = require('url'),
		querystring = require('querystring');

var HTTPClient = function(uri, method, headers, data, callback){

	this.perform = function(){

		var remote = url.parse(uri);
		var https = remote.protocol === "https:"
		var port = remote.port || (https ? 443 : 80);

		var default_headers = {
			"Host" : remote.host,
			"User-Agent": "Node-Http",
			"Connection": "close",
			"Accept": "*/*"
		}

		for(h in headers)
			if(headers.hasOwnProperty(h)) default_headers[h] = headers[h];

		if(data) {
			var post_data = typeof(data) === "object" ? querystring.stringify(data) : data;
			default_headers['Content-Length'] = post_data.length.toString();
			default_headers['Content-Type'] = "application/x-www-form-urlencoded"
		}

		var http_client = http.createClient(port, remote.host);
		var request = http_client.request(method, remote.pathname, default_headers);
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

	this.add_headers = function(){
		console.log('test')
	},

	this.perform();

}

// sys.inherits(HTTPClient, events.EventEmitter);

exports.get = function(uri, headers, callback){
	return new HTTPClient(uri, "GET", headers, false, callback);
}

exports.post = function(uri, data, headers, callback){
	return new HTTPClient(uri, "POST", headers, data, callback);
}

exports.put = function(uri, data, headers, callback){
	return new HTTPClient(uri, "POST", headers, data, callback);
}

exports.delete = function(uri, data, headers, callback){
	return new HTTPClient(uri, "DELETE", headers, false, callback);
}
