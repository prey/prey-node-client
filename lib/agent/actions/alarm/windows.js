"use strict";

var join = require('path').join,
    exec = require('child_process').exec;

exports.play_sound = function(sound_file, callback){

  var cmd = join(__dirname, 'bin', 'mpg123') + ' ' + sound_file;

	var child = exec(cmd, function(err){
	  callback(err, child);
	});
};
