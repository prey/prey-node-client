//////////////////////////////////////////
// Prey Actions Manager Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		logger = base.logger,
		util = require('util'),
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

	this.action_returned = function(action_module, running){
		logger.info(' -- Action module ' + action_module.name + ' finished.');

		this.returned_actions++;

		if(!running) this.remove_from_running(action_module);

		if(this.returned_count >= this.enabled_count) {
			logger.info(" -- All actions returned!");
			this.emit('all_returned', this.running_actions);
		}

	};

	this.action_ended = function(action_module, success){

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
				logger.info(" -- " + running_action.name + " action was turned off!")
				self.stop(running_action);
			}

		});

		enabled_action_modules.forEach(function(action_module){

			if(self.action_is_running(action_module)) {
				logger.info(" -- " + action_module.name + " is already running!")
			} else {
				self.queue(action_module);
			}

		});

	}

	this.queue = function(action_module){

		logger.info(' -- Queueing action ' + action_module.name);

		this.once('start', function(){
			logger.info(' -- Running action ' + action_module.name);

			// self.running_actions[action_module.name] = action_module;
			self.running_actions.push(action_module);

			var instance = action_module.init(action_module.config);

			// if the action returns a class instance, it's a long running/persistent
			// action, which means we need to listen for the 'end' event to know
			// when it really finishes

			if(typeof instance == 'function'){
				instance.on('end', function(success){
					self.action_ended(action_module, success);
				});
			}

			action_module.start(function(running){
				self.action_returned(action_module, running);
			});

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
		action_module.stop();

	};

}

util.inherits(ActionsManager, emitter);
module.exports = new ActionsManager(); // singleton
