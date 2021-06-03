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
    system   = require('./../../common').system, 
    linux_alarm = require('./linux'),
    is_linux = os_name == 'linux';

var child,
    emitter,
    raise_interval,
    volume = '100';

exports.start = function(options, cb) {

  var error,
      self     = this,
      returned = 0;

  var options = options || {},
      type    = options.file || options.sound || 'alarm',
      file    = type + '.mp3',
      loops   = options.loops ? parseInt(options.loops) : 1;

  var done = function(err) {
    clearInterval(raise_interval);
    if (returned++) returned;
    if (emitter) emitter.emit('end', err);
    emitter = null;
  }

  var raise_volume = function(cb) {
    if (is_linux) linux_alarm.setVolume(volume);
    else exec(commands.raise_volume, cb);
  }

  var play_queue = function() {
    loops--;

    system.spawn_as_logged_user(commands.play, [ file ], function(err, alarm) {
      if (err) return done(err);

      alarm.on('error', done);

      alarm.once('exit', function(code) {
        child = null;

        if (loops === 0)
          return done();

        play_queue();
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
    }, 1000)

  });

};

exports.stop = function() {
  if (child && !child.exitCode) {
    child.kill();
  }
}
