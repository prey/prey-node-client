"use strict";

////////////////////////////////////////////
// (C) 2018 Prey, Inc.
// By Javier Acuña - http://preyproject.com
// GPLv3 Licensed
////////////////////////////////////////////

module.exports.get_file_type = function(path, cb) {
  var exec = require('child_process').exec,
      cmd  = 'type ' + path;

  exec(cmd, function(err, stdout) {
    var format = "ASCII";
    if (err) return cb(new Error("Error getting file type"))
    
    if (stdout.includes('SQLite')) format = "SQLite";
    cb(null, format);
  });
};