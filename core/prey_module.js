//////////////////////////////////////////
// Prey Module Main Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		util = require('util'),
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

	this.apply_config = function(config){
		// this.config = this.config.merge(config);
		this.config = mixin(this.options || {}, config);
	}

	this.path = function(){
		return base.modules_path + '/' + this.name;
	}

	this.log = function(str){
		console.log(" ++ [" + this.name + "] " + str);
	};

	this.init = function(){

//		try {
//			self.config = require(this.path + "/config").default;
//		} catch(e) {
//			self.config = {};
//		}

		this.loaded = true;
		this.emit('ready');

	}

	this.done = function(){
		if(this.running){
			this.running = false;
			this.emit('end');
		}
	}

	this.init();

}

util.inherits(PreyModule, emitter);
module.exports = PreyModule;
