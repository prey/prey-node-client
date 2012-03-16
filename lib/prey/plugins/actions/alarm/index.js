//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var GStreamer = require('spaghetti'),
		path = require('path');

exports.start = function(options, callback){

	var sound_file = options.sound_file || options.sound || 'alarm.mp3';
	sound_file = path.existsSync(sound_file) ? sound_file : path.join(__dirname, 'lib', sound_file);
	var loops = options.loops || 1;
	var returned = false;
	// console.log(loops);

	for(i = 0; i < loops; i++){

		// console.log("Playing sound: " + sound_file);
		GStreamer.playSound(sound_file, function(was_played){

			if(!returned){
				returned = true;
				if(was_played)
					callback();
				else
					callback(new Error("Unable to play sound"))
			}

		});
	}

}
