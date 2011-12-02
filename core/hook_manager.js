//////////////////////////////////////////
// Prey JS Hook Manager
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var base = require('./base'),
		logger = base.logger,
		util = require('util'),
		emitter = require('events').EventEmitter;

function HookManager(){

	var self = this;
	var list = [];

	this.log = function(str){
		logger.info(" -- [hooks] " + str);
	};

	this.register = function(hook, callback){
		this.log("Registering callback for hook " + hook)
		this.once(hook, callback);
	};

	this.trigger = function(hook_name){
		this.log("hook " + hook_name + " triggered");
		this.emit(hook_name);
	};

};

util.inherits(HookManager, emitter);
module.exports = new HookManager();
