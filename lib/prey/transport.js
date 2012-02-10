//////////////////////////////////////////
// Prey Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		util = require('util'),
		Emitter = require('events').EventEmitter;

var Transport = function(options) {

	var self = this;
	this.options = options;
	// this.name = 'base';

	this.log = function(str){
		logger.info('[' + this.name + ' transport] ' + str);
	};

	this.on('start', function(){
		this.began_at = new Date();
		this.log("Began at " + this.began_at);
	});

	this.on('end', function(success){
		this.finished_at = new Date();
		var timediff = this.finished_at - this.began_at;
		if(success)
			this.log("All good. Transfer took " + timediff/1000 + " seconds.");
		else
			this.log("Sending failed!");

	});

	this.send = function(data){
		// redefined by children
	};

}

util.inherits(Transport, Emitter);
module.exports = Transport;