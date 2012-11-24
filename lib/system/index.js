var fs      = require('fs'),
    join    = require('path').join,
    cp      = require('child_process'),
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

system.tempfile_path = function(filename){
  return join(system.paths.temp, filename);
};

system.spawn_as_logged_user = function(command, args, callback){
  as_logged_user('spawn', command, args, callback);
}

system.run_as_logged_user = function(command, args, callback){
  as_logged_user('exec', command, args, callback);
};

var as_logged_user = function(type, bin, args, callback){

  system.logged_user(function(err, user){
    if (err) return callback(err);

    var runner  = join(__dirname, '..', 'utils', 'runner.js'),
        command = [user, bin].concat(args);

    if (type == 'spawn')
      return callback(cp.spawn(runner, command));
    else
      cp.exec(runner + ' ' + command.join(' '), callback);
  })

};
