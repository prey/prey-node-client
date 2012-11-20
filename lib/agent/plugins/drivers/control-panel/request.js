"use strict";

//////////////////////////////////////////
// Prey Request Class
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomas Pollak
// GPLv3 Licensed
//////////////////////////////////////////

var common = _ns('common'),
		config = common.config,
		logger = common.logger,
		util = require('util'),
		emitter = require('events').EventEmitter,
		needle = require('needle'),
		reports = _ns('reports');

var Request = function(urls, options) {

	var self = this,
	    options = options || {};

	this.uris = urls;
	this.report_status = options.report_status;

  //this.last_error;
	this.log = function(str){
		logger.info("[request] " + str);
	};

	this.got_error = function(err){
		this.last_error = err;
	};

	this.start = function(cb){

		var options = {
			parse: false,
			headers: {
				'User-Agent': common.user_agent,
				'X-Encrypt-Response': 'aes-128-cbc'
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

		  if (config.get('try_proxy')) { // reset attempts and try again
			  opts.proxy = config.get('proxy_url');
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

			  self.got_error(err);
			  self.fetch(attempt+1, opts);

		  } else if (!self.valid_status_code(resp.statusCode)) {

			  logger.error("Got unexpected status code: " + resp.statusCode);
			  self.got_error(_error(body));
			  self.fetch(attempt+1, opts);

		  } else {

			  self.log('Got status code: ' + resp.statusCode);
			  cb(null, resp, body);

		  }

	  });

  }

};

util.inherits(Request, emitter);

exports.make = function(url, options, cb){
  var req = new Request(url, options);
  req.start(cb);
  return req;
}
