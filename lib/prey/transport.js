//////////////////////////////////////////
// Prey Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		fs = require('fs'),
		util = require('util'),
		Emitter = require('events').EventEmitter;

var Transport = function(options) {

	var self = this;
	this.options = options;
	// this.name = 'base';

	this.log = function(str){
		logger.info('[' + this.name + '] ' + str);
	};

	this.once('start', function(){
		this.began_at = new Date();
		this.log("Began at " + this.began_at);
	});

	this.once('end', function(err, data){
		this.finished_at = new Date();
		var timediff = this.finished_at - this.began_at;
		
		if(err)
			this.log("Sending failed: " + err.toString());
		else
			this.log("All good. Transfer took " + timediff/1000 + " seconds.");

		if(data)
			this.remove_files(data);

	});

	this.remove_files = function(data){

		logger.debug("[" + this.name + "] Cleaning up files...");

		for(key in data){

			var val = data[key];
			if(!val) continue;

			if(val.file && val.content_type) {

				logger.info("Removing " + key + ": " + val.file);
				try{
					fs.unlink(val.file);
				} catch(e) { }

			}

		}

	};

	this.send = function(data, options){
		// redefined by children
	};

}

util.inherits(Transport, Emitter);
module.exports = Transport;