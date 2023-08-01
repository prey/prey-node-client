"use strict";

//////////////////////////////////////////
// Prey JS Webcam Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs        = require('fs'),
    join      = require('path').join,
    exec      = require('child_process').exec,
    common    = require('../../../../common'),
    temp_path = common.system.tempfile_path;

exports.get_picture = function(main_callback){

  var picture_file = temp_path('picture.' + process.pid + '.jpg'),
      tmp_path     = '/tmp',
      size         = '640x480',
      device       = '/dev/video0';

  function frame_file(number, extension){
    return join(tmp_path, 'streamer' + number.toString() + extension);
  }

  function remove_frames(number, ext){
    for (var i = 0; i <= number; i++) {
      fs.unlink(frame_file(i, ext), function(){ /* noop */ });
    }
  }

  function call_streamer(extension, callback) {
    var last_frame = frame_file('3', extension);
    var str = 'streamer -c ' + device + ' -s ' + size + ' -t 4 -r 0.5 -o ' + frame_file('0', extension);

    exec(str, function(err) {
      if (err) {
        if (err.message.match('did you mean the "video1"')) {
          device = '/dev/video1';
          return call_streamer(extension, callback);
        } else {
          return callback(err);
        }
      }

      let exists = fs.existsSync(last_frame)
      if (exists){
        remove_frames(2, extension);
        callback(null, last_frame);
      } else {
        callback(new Error('Could not get image.'));
      }
    });
  }

  call_streamer('.jpeg', function(err, file){

    if (!err && file){

      fs.rename(file, picture_file, function(err) {
        if (err) return main_callback(err);
        main_callback(null, picture_file, 'image/jpeg');
      });

    } else {

      // console.log("Couldn't get JPEG image. Trying PPM.")
      call_streamer('.ppm', function(err, file){
        if (err) return main_callback(err);

        // convert using imagemagick
        var cmd = 'convert ' + file + ' ' + picture_file;

        exec(cmd, function(err){
          if (!err) return main_callback(null, picture_file, 'image/jpeg'); // converted image

          fs.rename(file, picture_file, function(err){
            if (err) return main_callback(err);
            else main_callback(null, picture_file, 'image/ppm'); // return original
          });
        });
      });

    }
  });
};
