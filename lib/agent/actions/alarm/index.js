"use strict";

//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs      = require('fs'),
    path    = require('path'),
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name),
    Emitter = require('events').EventEmitter,
    system  = require('./../../common').system,
    child;

exports.start = function(options, callback){

  var self = this,
      emitter = new Emitter();

  var options = options || {};
  var sound_file = options.file || options.sound || 'siren.mp3';
  var loops = options.loops || 1;

  var done = function(err){
    emitter.emit('end', err);
  }

  var play_queue = function(){
    loops--;

    system.spawn_as_logged_user(os_functions.command, [ sound_file ], function(err, child){
      if (err) return done(err);

      child.once('exit', function(code){
        if (loops === 0) return done();
        play_queue();
      })
    });

  };

  fs.exists(sound_file, function(exists){
    if (!exists) sound_file = path.join(__dirname, 'lib', sound_file);
    play_queue();
  });

  callback(null, emitter);

};

exports.stop = function(){

  if (child && !child.exitCode)
    child.kill();
}
