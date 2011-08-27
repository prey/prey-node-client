//////////////////////////////////////////
// Prey Actions Manager Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		emitter = require('events').EventEmitter;

var ActionsManager = function(){

	var self = this;
	this.running_actions = [];

	this.start_all = function(){
		console.log(' -- Starting all actions!')
		this.emit('start');
	};

	this.action_finished = function(module_name){
		console.log(' -- ' + module_name + ' module returned.');
		delete this.running_actions[module_name];
	};

	this.action_is_running = function(action_module){
		return (this.running_actions.indexOf(action_module) != -1);
	}

	this.initialize = function(enabled_action_modules){

		this.running_actions.forEach(function(name, running_action){

			if(enabled_action_modules.indexOf(running_action) == -1){
				console.log(name + " action was turned off!")
				self.stop(name);
			}

		});

		enabled_action_modules.forEach(function(action_module){

			if(self.action_is_running(action_module)) {
				console.log(action_module.name + " is already running!")
			} else {
				self.queue_one(action_module);
			}

		});

	}

	this.queue_one = function(action_module){

		console.log(' -- Queueing action ' + action_module.name);

		self.on('start', function(){
			console.log(' -- Running action ' + action_module.name);

			// self.running_actions[action_module.name] = action_module;
			self.running_actions.push(action_module);
			action_module.run();

			action_module.on('end', function(){
				self.action_finished(action_module.name);
			});

		});

	}

	this.stop_all = function(){

		running_actions.forEach(function(action){
			self.stop(action);
		});

	};

	this.stop = function(action_module){

		// var action_module = this.running_actions[action_module_name];
		action_module.stop();

	};

}

sys.inherits(ActionsManager, emitter);
module.exports = new ActionsManager(); // singleton
