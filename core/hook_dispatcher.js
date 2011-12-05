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
		Notifier = require('./notifier'),
		emitter = require('events').EventEmitter;

function HookDispatcher(){

	var self = this;
	this.setMaxListeners(20);
	this.active = [];

	this.log = function(str){
		logger.info(" -- [hooks] " + str);
	};

	this.trigger = function(hook, args){
		this.log("hook " + hook + " triggered");
		this.emit(hook, args);
		this.remove_from_list(hook);
	};

	this.trigger_and_notify = function(hook, args){
		var message = { event: hook }
		if(args) message.data = args;
		Notifier.send(message);
		this.trigger(hook, args);
	};

	this.register = function(hook, callback){

		this.log("Registering callback for hook " + hook);

		if(typeof callback == 'function')
			this.once(hook, callback);
		else
			this.once(hook, function(){
				Prey.handle_incoming_message(callback.command, callback.data);
			});

		this.active.push(hook);

	};

	this.unregister_if_missing = function(hook_list){

		// we need to keep this in a new array because unregister modifies the original
		var hooks_to_remove = [];

		this.active.forEach(function(hook){
			if(hook_list.indexOf(hook) == -1)
				hooks_to_remove.push(hook);
		});

		hooks_to_remove.forEach(function(hook){
			self.unregister(hook);
		});

	};

	this.unregister = function(hook){

		this.log("Unregistering hook: " + hook);

		this.removeAllListeners(hook);
		this.remove_from_list(hook);

	};

	this.remove_from_list = function(hook){
		var index = this.active.indexOf(hook);
		if(index != -1) this.active.splice(index, 1);
	};

};

util.inherits(HookDispatcher, emitter);
module.exports = new HookDispatcher(); // singleton
