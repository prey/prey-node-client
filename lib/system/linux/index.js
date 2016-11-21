"use strict";

//////////////////////////////////////////
// Prey Node.js Linux Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var cp       = require('child_process'),
    release  = require('os').release,
    distro   = require('linus'),
    exec     = cp.exec,
    execSync = cp.execSync;

exports.get_os_name = distro.name;

exports.get_os_version = function(callback) {
  var stdout;
  try {
    stdout = execSync('lsb_release -rs');
  } catch (e) {
    return cb(new Error("Couldn't get OS version."))
  }
  callback(null, stdout.toString().trim());
}

/**
 *  Callsback the user logged in.
 **/
exports.find_logged_user = function(callback) {
  var daemons = 'ssh-agent|gnome-keyring-daemon|kde-authentication-agent',
      command = "export PS_FORMAT=user:16,command; ps ax | egrep '" + daemons + "' | grep -v grep | cut -d' ' -f1";

  exec(command, function(err, out) {
    if (err) return callback(err);

    var first = out.toString().split('\n')[0];
    callback(null, first);
  });
};

exports.process_running = function(process_name, callback){
  var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
  exec(cmd, function(err, stdout){
    callback(stdout && stdout.toString().trim() === '1');
  });
};

// restarts NetworkManager so it reconnects
exports.reconnect = function(callback){
  var cmd = "service NetworkManager restart";
  exec(cmd, callback);
};
