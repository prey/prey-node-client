//////////////////////////////////////////
// Prey Transport Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./base').logger,
		util = require('util'),
		emitter = require('events').EventEmitter;

var Transport = function(options) {

	var self = this;
	this.options = options;
	this.name = 'base';

	this.log = function(str){
		logger.info(' -- [' + this.name + ' transport] ' + str);
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

	this.send = function(data){
		// redefined by children
	};

}

util.inherits(Transport, emitter);
module.exports = Transport;
