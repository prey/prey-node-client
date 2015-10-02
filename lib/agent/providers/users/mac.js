"use strict";

////////////////////////////////////////////
// (c) 2011 - Fork Ltd.
// By Mauricio Schneider - http://preyhq.com
// GPLv3 Licensed
////////////////////////////////////////////

var exec = require('child_process').exec,
    cmd = 'ls /Users/';

module.exports.get_users_list = function(cb) {
  exec(cmd, function(err, stdout) {
    // stdout format: 'Guest\nShared\nsomeuser\n'
    cb(err, stdout.split("\n").slice(0, -1));
  });
};
