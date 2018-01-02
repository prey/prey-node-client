"use strict";

//////////////////////////////////////////
// (C) 2018 Prey, Inc.
// By Javir Acuña - http://preyproject.com
// GPLv3 Licensed
// Prey File Type discriminate if a file has ASCII or SQLite format, used for 
// the commands.db file
////////////////////////////////////////////

var os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + os_name);

module.exports.get_file_type = function(path, cb) {
  os_functions.get_file_type(path, function(err, file_type) {
    if (err) return cb(err);

    return cb(null, file_type);
  });
}