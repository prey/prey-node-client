//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		Command = require('../../lib/command'),
		ActionModule = require('../../core/action_module');

var Alarm = function(){

	ActionModule.call(this);
	var self = this;
	this.name = 'alarm';

	this.options = {
		sound: "siren.mp3"
	}

	this.start = function(){

		var sound_file = __dirname + "/lib/" + this.options.sound;
		this.alarm_command = new Command('mpg123 ' + sound_file);

		this.alarm_command.on('error', function(e){
			console.log(e.message);
		});

//		this.alarm_command.on('return', function(output){
//			console.log(output);
//		});

		self.done();

	}

	this.stop = function(){
		this.alarm_command.kill();
	}

};

sys.inherits(Alarm, ActionModule);
module.exports = new Alarm();
