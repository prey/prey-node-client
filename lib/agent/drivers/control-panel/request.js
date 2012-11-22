"use strict";

//////////////////////////////////////////
// Prey Request Class
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var needle   = require('needle'),
    logger  = require('./../../common').logger,
		reports = require('./../../reports');

var Request = function(urls, options) {

	var self = this,
	    options = options || {};

	this.uris = urls;
  this.last_error;
	this.encrypt_with = 'aes-128-cbc';
	this.user_agent = options.user_agent;
	this.report_status = options.report_status;
  this.proxy_url = options.proxy_url;

	this.log = function(str){
		logger.info("[request] " + str);
	};

	this.start = function(cb){

		var options = {
			parse: false,
			headers: {
				'User-Agent': this.user_agent,
				'X-Encrypt-Response': this.encrypt_with
			}
		};

		if (this.report_status) {

			this.append_status_report(options.headers, function(headers){
				options.headers = headers;
				self.fetch(0, options, cb);
			});

		} else {

			this.fetch(0, options, cb);

		}

  }

  // other types of information that may be useful to know:
  // cpu usage, ram usage, hdd usage, total running programs ?
  this.append_status_report = function(headers, cb){

    var headerize = function(str){
       return str.replace(/_/g, '-')
                 .replace(/(^|\-)\w/g, function($0) {
                    return $0.toUpperCase();
                 });
     };

    reports.get('status', function(err, data){
      if (err) return cb(headers);

      for (var key in data) {
        var key_header = 'X-Prey-' + headerize(key);
        headers[key_header] = data[key];
      }

      cb(headers);
    });
  },

  this.log_response_time = function(){
    var now = new Date();
    var seconds = (now - this.start_time)/1000;
    this.log("Request took " + seconds.toString() + " seconds.");
  };

  this.valid_status_code = function(code){
	  return code === 200 || code === 201 || code === 404;
  };

  this.fetch = function(attempt, opts, cb){

    var url = this.uris[attempt];

    if (typeof url === 'undefined') {

		  if (this.proxy_url) { // reset attempts and try again
			  opts.proxy = this.proxy_url;
			  this.log('Trying via proxy: ' + opts.proxy);
			  return this.fetch(0, opts);
		  } else {
			  return cb(this.last_error);
		  }

	  }

	  var host = url.replace(/.*\/\/([^\/]+).*/, "$1");
	  this.start_time = new Date();
	  this.log("Connecting to " + host + "...");

	  needle.get(url, opts, function(err, resp, body){

		  self.log_response_time();

		  if (err) {

			  self.last_error = err;
			  self.fetch(attempt+1, opts, cb);

		  } else if (!self.valid_status_code(resp.statusCode)) {

			  logger.error("Got unexpected status code: " + resp.statusCode);
			  self.last_error = err;
			  self.fetch(attempt+1, opts, cb);

		  } else {

			  self.log('Got status code: ' + resp.statusCode);
			  cb(null, resp, body);

		  }

	  });

  }

};

exports.make = function(url, options, cb){
  var req = new Request(url, options);
  return req.start(cb);
}
