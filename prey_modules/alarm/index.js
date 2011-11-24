//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		Command = require('../../lib/command'),
		GStreamer = require('node-gstreamer'),
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

		this.alarm_command = GStreamer.playSound(sound_file, function(was_played){
			self.done();
		});

	}

	this.stop = function(){
		this.alarm_command.kill(); // will trigger 'exit' event
	}

};

util.inherits(Alarm, ActionModule);
module.exports = new Alarm();
