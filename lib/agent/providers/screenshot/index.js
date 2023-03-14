"use strict";

//////////////////////////////////////////
// Prey JS Screenshot Module
// (c) 2020 - Prey Inc.
// By Javier Acuña - https://preyproject.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs           = require('fs'),
    common       = require('./../../common'),
    os_functions = require('./' + common.os_name);

exports.get_screenshot = (callback) => {

  os_functions.get_screenshot((err, file_path, file_type) => {
    if (err) return callback(err);

    fs.existsSync(file_path, (exists) => {
      if (!exists) {
        return callback(new Error('Screenshot failed'));
      }

      var size = fs.statSync(file_path).size;
      if (size > 1500000) {
        return callback(new Error('Screenshot failed: Image is too heavy'));
      }
      callback(null, {file: file_path, content_type: file_type});
    });
  });

};