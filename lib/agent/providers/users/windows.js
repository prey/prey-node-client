"use strict";

////////////////////////////////////////////
// (c) 2019 Prey, Inc.
// By Javier Acuña - http://preyproject.com
// GPLv3 Licensed
////////////////////////////////////////////

var exec = require('child_process').exec,
    cmd = 'wmic logicaldisk get deviceid';

module.exports.get_users_list = function(cb) {
  exec(cmd, function(err, stdout) {
    cb(err, stdout.split("\n").slice(1, -2));
  });
};
