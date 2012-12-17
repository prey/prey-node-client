"use strict";

//////////////////////////////////////////
// Prey JS Webcam Module Linux Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
    join = require('path').join,
    exec = require('child_process').exec;

exports.get_picture = function(picture_file, main_callback){

  var temp_path = '/tmp';

  function frame_file(number, extension){
    return join(temp_path, 'streamer' + number.toString() + extension);
  }

  function remove_frames(number){
    for (var i = 0; i <= number; i++) {
      fs.unlink(frame_file(number));
    }
  }

  function call_streamer(extension, callback){
    var last_frame = frame_file('3', extension);
    var str = 'streamer -t 4 -r 0.5 -o ' + frame_file('0', extension);

    exec(str, function(err){
      if (err) return callback(err);

      fs.exists(last_frame, function(exists){
        if (exists){
          remove_frames(2, extension);
          callback(null, last_frame);
        } else {
          callback(new Error('Could not get image.'));
        }
      });
    });
  }

  call_streamer('.jpeg', function(err, file){

    if (!err && file){

      fs.rename(file, picture_file, function(err) {
        if (err) return main_callback(err);
        main_callback(null, 'image/jpeg');
      });

    } else {

      // console.log("Couldn't get JPEG image. Trying PPM.")
      call_streamer('.ppm', function(err, file){
        if (err) return main_callback(err);

        // convert using imagemagick
        var cmd = 'convert ' + file + ' ' + picture_file;

        exec(cmd, function(err){
          if (!err) return main_callback(null, 'image/jpg'); // converted image

          fs.rename(file, picture_file, function(err){
            if (err) return main_callback(err);
            else main_callback(null, 'image/ppm'); // return original
          });
        });
      });

    }
  });
};
