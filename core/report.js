//////////////////////////////////////////
// Prey Report Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		http_client = require('http_client'),
		emitter = require('events').EventEmitter;

var Report = function(data, remote_config){

	// var self = this;

	this.send_via_http = function(){

		log(" -- Sending report via HTTP...");

		var post_url = remote_config.post_url || config.check_url + "/devices/" + config.device_key + "/reports.xml";

		debug(" -- HTTP endpoint: " + post_url);

		var http_opts = {
			user: config.api_key,
			pass: "x",
			headers : { "User-Agent" : user_agent }
		}

		http_client.post(post_url, data, http_opts, function(response, body){
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
