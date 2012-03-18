//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var path = require('path'), 
		common = require('./../../../common'),
		os_functions = require('./platform/' + common.os_name);

exports.start = function(options, callback){

	var sound_file = options.sound_file || options.sound || 'alarm.mp3';
	sound_file = path.existsSync(sound_file) ? sound_file : path.join(__dirname, 'lib', sound_file);
	var loops = options.loops || 1;

	var play_queue = function(){
		loops--;
		os_functions.play_sound(sound_file, function(err){
			if(err || loops == 0) return callback();
			play_queue();
		})
	};
	
	play_queue();

}
