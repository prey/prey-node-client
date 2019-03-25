"use strict";

////////////////////////////////////////////
// (C) 2019 Prey, Inc.
// By Mauricio Schneider - http://preyproject.com
// GPLv3 Licensed
////////////////////////////////////////////

var exec = require('child_process').exec,
    cmd = 'ls /home/';

module.exports.get_users_list = function(cb) {
  exec(cmd, function(err, stdout) {
    cb(err, stdout.split("\n").slice(0, -1));
  });
};
