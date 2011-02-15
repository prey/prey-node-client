//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////


var sys = require('sys'), events = require('events'), command = require('../../lib/command');

var Alarm = function(config){

	var options = {
		sound: "siren.mp3"
	}

	var self = this;
	var data = {};

	this.run = function(){
		var sound_file = __dirname + "/lib/" + options.sound;
		var cmd = command.run('mpg123 ' + sound_file);

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
