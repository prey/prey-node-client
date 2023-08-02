"use strict";

var fs           = require('fs'),
    join         = require('path').join,
    exec         = require('child_process').exec,
    system       = require('../../../system'),
    osName      = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    temp_path    = system.tempfile_path;

exports.get_extra_attachment = (callback) => {
  if (osName != "windows") return cb(new Error('Only available on windows'));
  
  var exe  = '/prey-webcam.exe',
      opts = ' -invalid youcam,cyberlink,google,rear -frame 10 -outfile ',
      file_path = temp_path('extra_attachment.' + process.pid + '.jpg'),
      picture_command = '"' + join(__dirname, '..' , 'webcam', 'windows', exe) + '"' +  opts + file_path;

  var take_picture = () => {
    exec(picture_command, (err) => {
      if (err) return callback(err);
      let exists = fs.existsSync(file_path)
      if (exists)
        callback(null, {file: file_path, content_type: 'image/jpeg'});
      else
        callback(err || new Error("Couldn't grab extra picture using the webcam."));
    });
  }

  fs.unlink(file_path, () => {
    take_picture();
  })
};