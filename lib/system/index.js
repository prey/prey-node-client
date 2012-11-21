var fs = require('fs'),
    path = require('path'),
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    system = require(path.join(__dirname, os_name));

module.exports = system;
system.os_name = os_name;
system.paths = require('./paths');

/**
 * Callsback name of currently logged in user.
 **/
system.logged_user = function(callback){

  if (process.env.LOGGED_USER)
    return callback(null, process.env.LOGGED_USER);

  module.exports.get_logged_user(function(err, user_name) {
    if (err) return callback(err);

    if (user_name && user_name !== '')
      callback(null, user_name);
    else
      callback(new Error('No logged user found.'));
  });
};

system.tempfile_path = function(filename){
  return path.join(system.paths.temp, filename);
};
