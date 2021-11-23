"use strict";

//////////////////////////////////////////
// Prey JS Alarm Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs       = require('fs'),
    path     = require('path'),
    exec     = require('child_process').exec,
    os_name  = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    commands = require('./' + os_name),
    Emitter  = require('events').EventEmitter,
    system   = require('./../../common').system;

var child,
    emitter,
    raise_interval;

exports.start = function(id, options, cb) {
  var error,
      self     = this,
      returned = 0;

  var options = options || {},
      type    = options.file || options.sound || 'alarm',
      file    = type + '.mp3';
  var loops = 1;
  if(parseInt(options.loops) > 1 && parseInt(options.loops) <= 5) {
    loops = parseInt(options.loops);
  }
  var secondsbetween = 0;
  if(parseInt(options.secondsbetween) >= 5 && parseInt(options.secondsbetween) <= 15) {
    secondsbetween = parseInt(options.secondsbetween);
  }
  var done = function(id, err) {
    clearInterval(raise_interval);
    if (returned++) returned;
    if (emitter) emitter.emit('end', id, err);
    emitter = null;
  }

  var raise_volume = function(cb) {
    exec(commands.raise_volume, cb);
  }

  var play_queue = function() {
    loops--;

    system.spawn_as_logged_user(commands.play, [ file ], function(err, alarm) {
      if (err) return done(id, err);

      alarm.on('error', done);

      alarm.once('exit', function(code) {
        child = null;

        if (loops === 0){
          return done(id);
        }
        if(secondsbetween == 0){
          play_queue();
          return;
        }
        setTimeout(() => {
          play_queue();
        }, secondsbetween * 1000);
      })

      child = alarm;
    });
  };

  fs.exists(file, function(exists) {
    if (!exists) file = path.join(__dirname, 'lib', file);

    emitter = new Emitter();
    cb(null, emitter);

    play_queue();
    
    raise_interval = setInterval(function() {
      raise_volume();
    }, 1000);
  });
};

exports.stop = function() {
  if (child && !child.exitCode) {
    child.kill();
  }
}
