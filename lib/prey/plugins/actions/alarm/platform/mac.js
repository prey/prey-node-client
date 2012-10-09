"use strict";

var exec = require('child_process').exec;

exports.play_sound = function(sound_file, callback){
	exec('afplay ' + sound_file, callback);
};