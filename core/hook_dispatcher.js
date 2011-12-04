//////////////////////////////////////////
// Prey JS Hook Manager
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var base = require('./base'),
		Prey = require('./main'),
		logger = base.logger,
		util = require('util'),
		emitter = require('events').EventEmitter;

function HookDispatcher(){

	var self = this;
	this.list = [];

	this.log = function(str){
		logger.info(" -- [hooks] " + str);
	};

	this.trigger = function(hook_name, args){
		this.log("hook " + hook_name + " triggered");
		this.emit(hook_name, args);
	};

	this.register = function(hook, callback){
		this.log("Registering callback(s) for hook " + hook);

		if(util.isArray(callback))
			callback.forEach(function(cb){ self.register_callback(hook, cb) })
		else
			self.register_callback(hook, callback)
	};

	this.register_callback = function(hook, callback){

		if(typeof callback == 'function')
			this.once(hook, callback);
		else
			this.once(hook, function(){
				Prey.handle_incoming_message(callback.command, callback.data);
			});

	};

};

util.inherits(HookDispatcher, emitter);
module.exports = new HookDispatcher(); // singleton
