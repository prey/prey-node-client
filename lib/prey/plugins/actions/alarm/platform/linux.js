var GStreamer = require('spaghetti');

exports.play_sound = function(sound_file, callback){

// console.log("Playing sound: " + sound_file);
	GStreamer.playSound(sound_file, function(was_played){

		callback(was_played ? null : new Error("Unable to play sound."))

	});

}