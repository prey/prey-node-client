var sys = require('sys'), events = require('events');

var Lock = function(){

	var self = this;
	var data = {};

	var run = function(){
		data.hola = 'que tal';
		self.emit('end', data);
	}

	run();

};

sys.inherits(Lock, events.EventEmitter);
exports.module = Lock;
