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
    spawn = require('child_process').spawn,
    is_linux = os_name == 'linux';

var child,
    emitter,
    raise_interval,
    volumen = '100';

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

  var setVolume = function (val, cb) {
    defaultDevice(function (err, dev) {
      if (err) {
      } else {
        amixer(['set', dev, val + '%'], function (err) {
        });
      }
    });
  };

  var raise_volume = function(cb) {
    if (is_linux) setVolume(volumen)
    else
      exec(commands.raise_volume, cb)
  }

  var amixer = function (args, cb) {

    var ret = '';
    var err = null;
    console.log(args)
    var p = spawn('amixer', args);

    p.stdout.on('data', function (data) {
      ret += data;
    });

    p.stderr.on('data', function (data) {
      err = new Error('Alsa Mixer Error: ' + data);
    });

    p.on('close', function () {
      cb(err, ret.trim());
    });

  };

  var reDefaultDevice = /Simple mixer control \'([a-z0-9 -]+)\',[0-9]+/i;
  var defaultDeviceCache = null;
  var defaultDevice = function (cb) {
    if (defaultDeviceCache === null) {
      amixer([], function (err, data) {
        if (err) {
          cb(err);
        } else {
          var res = reDefaultDevice.exec(data);
          if (res === null) {
            cb(new Error('Alsa Mixer Error: failed to parse output'));
          } else {
            defaultDeviceCache = res[1];
            cb(null, defaultDeviceCache);
          }
        }
      });
    } else {
      cb(null, defaultDeviceCache);
    }
  };


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
