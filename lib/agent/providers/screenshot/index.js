"use strict";

//////////////////////////////////////////
// Prey JS Screenshot Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var file_exists   = require('fs').exists,
    common        = require('./../../common'),
    os_name       = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    run_as_user   = common.system.run_as_logged_user,
    temp_path     = common.system.tempfile_path,
    optimize_jpg  = common.helpers.optimize_jpg,
    os_functions  = require('./' + common.os_name);

exports.get_screenshot = function(callback) {

  var file_path = temp_path('screenshot.' + process.pid + '.jpg');
  var cmd = os_functions.screenshot_cmd;

  run_as_user(cmd, ['"' + file_path + '"'], function(err, out) {
    // if (err) return callback(err);

    file_exists(file_path, function(exists) {
      if (!exists) {
        var msg = out ? out.toString().trim() : err ? err.message : '';
        return callback(new Error('Screenshot failed: ' + msg));
      }

      callback(null, {file: file_path, content_type: 'image/jpeg'});

      // optimize_jpg(file_path, function(err) {
      //   callback(null, {file: file_path, content_type: 'image/jpeg'});
      // })
    });

  });

};
