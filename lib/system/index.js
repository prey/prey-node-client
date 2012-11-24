var fs      = require('fs'),
    join    = require('path').join,
    exec    = require('child_process').exec,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    system  = require(join(__dirname, os_name));

module.exports = system;
system.os_name = os_name;
system.paths   = require('./paths');
system.delay   = require(join(__dirname, os_name, 'delay'));

/**
 * Callsback name of currently logged in user.
 **/
system.logged_user = function(callback){

  module.exports.get_logged_user(function(err, user_name) {
    if (err) return callback(err);

    if (user_name && user_name !== '')
      callback(null, user_name.split("\n")[0]);
    else
      callback(new Error('No logged user found.'));
  });
};

system.run_as_logged_user = function(command, args, callback){

  system.logged_user(function(err, user){
    if (err) return callback(err);

    var args_str = (typeof args === 'string') ? args : args.join(' '),
        runner   = join(__dirname, '..', 'utils', 'runner.js'),
        cmd = [runner, user, command, args_str].join(' ');

    exec(cmd, callback);
  })

};

system.tempfile_path = function(filename){
  return join(system.paths.temp, filename);
};
