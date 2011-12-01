//////////////////////////////////////////
// Prey Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		logger = base.logger,
		util = require('util'),
		emitter = require('events').EventEmitter;

var Transport = function(report, options) {

	var self = this;
	this.options = options;

	this.log = function(str){
		logger.info(' -- [transport:' + this.destination +'] ' + str);
	};

	this.on('start', function(){
		this.began_at = new Date();
		this.log("Began at " + this.began_at);
	});

	this.on('end', function(had_error){
		this.finished_at = new Date();
		var timediff = this.finished_at - this.began_at;
		if(had_error)
			this.log("Sending failed!");
		else
			this.log("Finished. Took " + timediff/1000 + " seconds.");
	});

}

util.inherits(Transport, emitter);
module.exports = Transport;
