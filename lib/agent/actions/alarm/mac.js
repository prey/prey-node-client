"use strict";

var exec = require('child_process').exec;

exports.play_sound = function(sound_file, callback){
	var child = exec('afplay ' + sound_file, function(err){
	  callback(err, child);
	});
};
