//////////////////////////////////////////
// Prey Actions Manager Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		logger = base.logger,
		util = require('util'),
		hooks = require('./hook_dispatcher'),
		emitter = require('events').EventEmitter;

var ActionsManager = function(){

	var self = this;
	this.running_actions = [];

	this.enabled_count = 0;
	this.returned_count = 0;

	this.start_all = function(){
		logger.info(' -- Starting all actions!')
		this.emit('start');
	};

	this.action_returned = function(action_module, success){

		var timediff = new Date() - action_module.started_at;
		var msg = action_module.name + ' module returned after ' + timediff/1000 + ' seconds. ';
		msg += success ? "Success!" : "No success.";
		logger.info(msg);

		this.returned_count++;

		// if immediate action returned or long running action was unsuccesful,
		// then we mark it as ended
		if(action_module.type == 'immediate' || !success)
			this.action_finished(action_module, success);

		if(this.returned_count >= this.enabled_count) {
			logger.info(" -- All actions returned!");
			this.emit('all_returned', this.running_actions);
		}

	};

	this.action_finished = function(action_module, success){
		this.remove_from_running(action_module);
	};

	this.action_is_running = function(action_module){
		return (this.running_actions.indexOf(action_module) != -1) ? true : false;
	}

	this.remove_from_running = function(action_module){
		var index = this.running_actions.indexOf(action_module);
		this.running_actions.splice(index, 1);
	};

	this.initialize = function(enabled_action_modules){

		this.enabled_count = enabled_action_modules.length;

		this.running_actions.forEach(function(running_action){

			if(enabled_action_modules.indexOf(running_action) == -1){
				logger.warn(" -- " + running_action.name + " action was turned off!")
				self.stop(running_action);
			}

		});

		enabled_action_modules.forEach(function(action_module){

			if(self.action_is_running(action_module)) {
				logger.warn(" -- " + action_module.name + " is already running!")
			} else {
				self.queue(action_module);
			}

		});

	};

	this.initialize_module = function(action_module, options){

		// attach our base logger so we can keep everything in one place
		if(!action_module.logger) action_module.logger = base.logger;

		// call init function of module which to see what we get
		var instance = action_module.init ? action_module.init(options || {}) : null;

		// register events if any
		if(instance && action_module.events && action_module.events.length > 0){
			action_module.events.forEach(function(event_name){
				instance.on(event_name, function(args){
					hooks.trigger(event_name, args);
				});
			});
		}

		// register hooks as well
		if(action_module.hooks && Object.keys(action_module.hooks).length > 0){
			for(hook in action_module.hooks){
				hooks.register(hook, action_module.hooks[hook]);
			}
		}

		return instance;

	};

	this.queue = function(action_module){

		logger.info(' -- Queueing action ' + action_module.name);

		this.once('start', function(){
			logger.info(' -- Running action ' + action_module.name);

			var instance = this.initialize_module(action_module, action_module.config);

			// if the returned object is an emitter, it's a long running/persistent
			// action, which means we need to listen for the 'end' event to know
			// when it really finishes

			if(instance && instance.emit){
				instance.once('end', function(success){
					self.action_finished(action_module, success);
				});
			} else {
				action_module.type = 'immediate';
			}

			if(action_module.start) {
				self.running_actions.push(action_module);
				action_module.started_at = new Date();
				action_module.start(function(success){
					self.action_returned(action_module, success);
				});
			}

		});

	}

	this.stop_all = function(){

		if(this.running_actions.length <= 0) return false;
		logger.info(" -- Stopping all actions!");

		this.running_actions.forEach(function(action_module){
			self.stop(action_module);
		});

	};

	this.stop = function(action_module){

		// var action_module = this.running_actions[action_module_name];
		if(action_module.stop) action_module.stop();

	};

}

util.inherits(ActionsManager, emitter);
module.exports = new ActionsManager(); // singleton
