"use strict";

var exec = require('child_process').exec;

exports.play_sound = function(sound_file, callback){
  var cmd = __dirname+'\\lib\\mpg123 ' + sound_file;
	exec(cmd, callback);
};