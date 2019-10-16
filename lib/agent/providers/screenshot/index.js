"use strict";

//////////////////////////////////////////
// Prey JS Screenshot Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs            = require('fs'),
    file_exists   = fs.exists,
    common        = require('./../../common'),
    os_name       = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    run_as_user   = common.system.run_as_logged_user,
    temp_path     = common.system.tempfile_path,
    optimize_jpg  = common.helpers.optimize_jpg,
    os_functions  = require('./' + common.os_name);

exports.get_screenshot = function(callback) {

  var file_path = temp_path('screenshot.' + process.pid + '.jpg'),
      cmd = os_functions.screenshot_cmd;

  if (os_name == 'mac' && common.os_release >= '10.15') {
    var extra_cmd = os_functions.screenshot_mac_cmd;

    run_as_user(extra_cmd, ['--args', '-screenshot'], (err) => {
      return run_cmd();
    });

  } else {
    run_cmd();
  }

  function run_cmd() {
    if (!cmd) return callback(new Error('Screenshot failed'));

    run_as_user(cmd, ['"' + file_path + '"'], function(err, out) {
      // if (err) return callback(err);

      file_exists(file_path, function(exists) {
        if (!exists) {
          var msg = out ? out.toString().trim() : err ? err.message : '';
          return callback(new Error('Screenshot failed: ' + msg));
        }

        var size = fs.statSync(file_path).size;
        if (size > 1500000) {
          return callback(new Error('Screenshot failed: Image is too heavy'));
        }

        callback(null, {file: file_path, content_type: 'image/jpeg'});

        // optimize_jpg(file_path, function(err) {
        //   callback(null, {file: file_path, content_type: 'image/jpeg'});
        // })
      });

    });
  }

};