"use strict";

var exec = require('child_process').exec;

//var GStreamer = require('spaghetti');

exports.play_sound = function(sound_file, callback){

// console.log("Playing sound: " + sound_file);
	//GStreamer.playSound(sound_file, function(was_played){

	//	callback(was_played ? null : new Error("Unable to play sound."));

	//});

  exec('mpg123 '+sound_file,function(err) {
    if (err) return callback(_error(err));
    callback(null);
  });

};