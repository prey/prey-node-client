var sys = require('sys'), emitter = require('events').EventEmitter;

var Transport = function(report, options) {

	var self = this;
	this.options = options;

	this.on('start', function(){
		this.began_at = new Date();
		console.log(" -- Report to " + this.destination + " began at " + this.began_at);
	});

	this.on('end', function(){
		this.finished_at = new Date();
		console.log(" -- Report to " + this.destination + " finished at " + this.finished_at);
	});

}

sys.inherits(Transport, emitter);
module.exports = Transport;
