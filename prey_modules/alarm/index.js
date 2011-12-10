//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var GStreamer = require('node-gstreamer');

function start_alarm(options, callback){

	var sound_file = options.sound_file || __dirname + '/lib/siren.mp3';
	var loops = options.loops || 1;
	var returned = false;

	for(i = 0; i < this.loops; i++){
		console.log("Playing sound: " + sound_file);
		GStreamer.playSound(sound_file, function(was_played){
			if(!returned)
				callback(was_played) && returned = true;
		});
	}

}

exports.start = function(options, callback){
	start_alarm(options, callback);
}
