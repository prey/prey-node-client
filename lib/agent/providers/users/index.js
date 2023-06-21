"use strict";

//////////////////////////////////////////
// (C) 2019 Prey, Inc.
// By Mauricio Schneider - http://preyproject.com
// GPLv3 Licensed
// Prey Users Provider returns the list of users of the device,
// particularly useful when child processes must be ran as a specific user or directory,
// ie: filebrowser.
////////////////////////////////////////////

var osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + osName);

module.exports.get_users_list = function(cb) {
  os_functions.get_users_list(function(err, users) {
    if (err) {
      return cb(err);
    }

    return cb(null, users);
  });
}
