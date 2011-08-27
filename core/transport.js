var sys = require('sys'), emitter = require('events').EventEmitter;

var Transport = function(report, options) {

	var self = this;
	this.options = options;

	this.began = function(){
		this.began_at = new Date();
		console.log("Began at " + began_at);
	};

	this.finished = function(){
		this.finished_at = new Date();
		console.log("Finished at " + began_at);
	}

}

sys.inherits(Transport, emitter);
module.exports = Transport;
