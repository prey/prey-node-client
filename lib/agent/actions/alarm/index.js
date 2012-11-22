"use strict";

//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
    path = require('path'),
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    child;

exports.start = function(options, callback){

  var sound_file,
      loops;

  if (options) {
    sound_file = options.sound_file || options.sound || 'alarm.mp3';
    loops = options.loops || 1;
  } else {
    sound_file = 'alarm.mp3';
    loops = 1;
  }

  var play_queue = function(){
    loops--;
    os_functions.play_sound(sound_file, function(err, command){
      child = command;
      if (err || loops === 0) return callback();
      play_queue();
    });
  };

  fs.exists(sound_file, function(exists){
    if (!exists) sound_file = path.join(__dirname, 'lib', sound_file);
    play_queue();
  });

};

exports.stop = function(cb){
  if (child.running)
    child.kill()
}
