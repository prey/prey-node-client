exports.play = 'mpg123';
exports.raise_volume = 'pactl set-sink-mute 0 0 && pactl set-sink-volume 0 65536';

var spawn = require('child_process').spawn;

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

  exports.setVolume = function (val, cb) {
    defaultDevice(function (err, dev) {
      if (err) {
      } else {
        amixer(['set', dev, val + '%'], function (err) {
          console.log(err)
        });
      }
    });
  };