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
	this.running_actions = {};

	this.start_all = function(){
		console.log(' -- Starting all actions!')
		this.emit('start');
	};

	this.action_finished = function(module_name){
		console.log(' -- ' + module_name + ' module returned.');
		delete this.running_actions[module_name];
	};

	this.queue_many = function(action_modules){

		action_modules.forEach(function(action_module){

			self.queue_one(action_module);

		});

	}

	this.queue_one = function(action_module){

		console.log(' -- Queueing action ' + action_module.name);
		self.on('start', function(){
			console.log(' -- Running action ' + action_module.name);

			self.running_actions[action_module.name] = action_module;
			action_module.run();

			action_module.on('end', function(){
				self.action_finished(action_module.name);
			});

		});

	}

	this.stop = function(action_module_name){

		var action_module = this.running_actions[action_module_name];
		action_module.stop();

	};

}

sys.inherits(ActionsManager, emitter);
module.exports = new ActionsManager(); // singleton
