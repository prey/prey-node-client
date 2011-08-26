//////////////////////////////////////////
// Prey Report Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		http_client = require('http_client'),
		emitter = require('events').EventEmitter;

var Report = function(data){

	var self = this;

	this.send_via_http = function(options){

		debug(" -- Sending HTTP report to " + options.post_url);

		var http_opts = {
			user: options.api_key,
			pass: "x",
			headers : { "User-Agent" : options.user_agent }
		}

		http_client.post(options.post_url, data, http_opts, function(response, body){
			console.log(' -- Got status code: ' + response.statusCode);
			console.log(' -- ' + body);
		})

	}

	this.send_via_smtp = function(data){
		console.log("Work in progress!");
	}

}

sys.inherits(Report, emitter);
module.exports = Report;
