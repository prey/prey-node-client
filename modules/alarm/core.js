var sys = require('sys'), events = require('events');

var Alarm = function(){

	var self = this;
	var data = {};

	var run = function(){
		data.hola = 'que tal';
		self.emit('end', data);
	}

	run();

};

sys.inherits(Alarm, events.EventEmitter);
exports.module = Alarm;
