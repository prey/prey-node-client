//////////////////////////////////////////
// Prey Report Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		http_client = require(base_path + '/vendor/restler'),
		emitter = require('events').EventEmitter;

var Report = function(data, remote_config){

	var self = this;

	this.flatten_data = function(object){
		var data = {};
		object.forEach(function(obj, key){
				obj.forEach(function(val, k){
					var f = key + '[' + k + ']';
					if(val instanceof String)
						data[f] = val;
					else {
						if (val.path){
							self.contains_files = true;
							data[f] = http_client.file(val.path, {content_type: val.type});
						} else
							data[f] = JSON.stringify(val);
					}
				});
		});
		return data;
	}

	this.send_via_http = function(){

		log(" -- Sending report via HTTP...");

		var post_url = remote_config.post_url || config.check_url + "/devices/" + config.device_key + "/reports.xml";

		debug(" -- HTTP endpoint: " + post_url);

		var http_opts = {
			username: config.api_key,
			password: "x",
			headers : { "User-Agent" : user_agent },
			data: this.flatten_data(data)
		}

		if(this.contains_files)
			http_opts.multipart = true;

		http_client.post(post_url, http_opts)
		.once('complete', function(body, response){
			console.log(' -- Got status code: ' + response.statusCode);
			// console.log(' -- ' + body);
		})
		.once('error', function(body, response){
			// console.log(' -- Got status code: ' + response.statusCode);
		});

	}

	this.send_via_smtp = function(data){
		console.log("Work in progress!");
	}

}

sys.inherits(Report, emitter);
module.exports = Report;
