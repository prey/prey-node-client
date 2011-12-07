//////////////////////////////////////////
// Prey Module Main Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		logger = base.logger,
		util = require('util'),
		hooks = require('./hook_dispatcher'),
		emitter = require('events').EventEmitter;

function mixin(target, source) {
	Object.keys(source).forEach(function(key) {
		// if value is 'y' or 'n' lets translate them to true or false
		val = source[key] == 'y' ? true : source[key] == 'n' ? false : source[key];
		target[key] = val;
	});

	return target;
}

function PreyModule(){

	var self = this;
	this.running = false;
	this.finished = false;

	this.path = function(){
		return base.modules_path + '/' + this.name;
	}

	this.log = function(str){
		logger.info(" ++ [" + this.name + "] " + str);
	};

	this.init = function(options){

		this.config = mixin(this.options || {}, options);

//		try {
//			self.config = require(this.path + "/config").default;
//		} catch(e) {
//			self.config = {};
//		}

		// this.loaded = true;
		// this.emit('ready');

		return this;

	}

	this.run = function(){

		if(!this.running){
			this.running = true;
			this.start();
			hooks.trigger(this.name + '_start');
		} else {
			this.log('Already running!')
		}

	};

	this.done = function(){
		if(!this.finished){
			this.running = false;
			this.finished = true;
			this.emit('end');
			hooks.trigger(this.name + '_end');
		}
	}

	// this.init();

}

util.inherits(PreyModule, emitter);
module.exports = PreyModule;
