//////////////////////////////////////////
// Prey Module Main Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		emitter = require('events').EventEmitter;

function mixin(target, source) {
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });

  return target;
}

function PreyModule(){

	var self = this;

	this.apply_config = function(config){
		// this.config = this.config.merge(config);
		this.config = mixin(this.options || {}, config);
	}

	this.path = function(){
		return modules_path + '/' + this.name;
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

		self.loaded = true;
		self.emit('ready');

	}

	this.done = function(){
		this.emit('end');
	}

	this.init();

}

sys.inherits(PreyModule, emitter);
module.exports = PreyModule;
