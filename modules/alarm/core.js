//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////


var sys = require('sys'), events = require('events');

var Alarm = function(config){

	var options = {
		hola: true,
		nada: false
	}

	var self = this;
	var data = {};

	this.run = function(){
		self.emit('trace', 'foo', 'bar')
		self.emit('end');
	}

	this.scream = function(){
		console.log("Screeeeeming")
	}

};

sys.inherits(Alarm, events.EventEmitter);

exports.init = function(config){
	return new Alarm(config);
}
