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

var get_admin_user_cmd = "getent group adm",
    python_version = ' -c "import platform; print(platform.python_version())"';

exports.get_os_name = distro.name;

exports.get_os_version = function(cb) {
  var release;
  try {
    release = execSync('lsb_release -rs');
  } catch (e) {
    return cb(new Error("Unable to determine Linux OS version."))
  }
  cb(null, release.toString().trim());
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
    if (first == 'root' || first == 'lightdm' || first == '')
      return callback(new Error("Couldn't find logged user."))

    callback(null, first);
  });
};

exports.find_admin_user = function(cb) {
  exec(get_admin_user_cmd, function(err, out) {
    if (err) return cb(err);

    var admins = out.replace(/\n/g, '').split(',');
    admins.shift();

    var non_root = admins.filter(function(x){ return x != '' && x != 'root' && x != 'syslog'});

    if (non_root.length == 0) return cb(new Error("Couldn't find admin user."))

    // Return the logged user if it's admin
    exports.find_logged_user(function(err, logged_user) {
      if (err) cb(null, non_root[0]);

      if (non_root.indexOf(logged_user) != -1)
        return cb(null, logged_user);
      else
        return cb(null, non_root[0]);
    });
  });
}

exports.process_running = function(process_name, callback){
  var cmd = 'ps ax | grep -v grep | grep -q ' + process_name + ' && echo 1';
  exec(cmd, function(err, stdout){
    callback(stdout && stdout.toString().trim() === '1');
  });
};

exports.get_lang = function(cb) {
  var lang = 'en',
      cmd  = "locale | awk 'NR==1'";
  exec(cmd, function(err, stdout) {
    if (!err && stdout.substring(5, 7) == 'es') lang = 'es';
    cb(lang);
  });
}

exports.get_current_hostname = (callback) => {
  exec("hostname", (err, stdout) => {
    if (err) return callback(err);
    
    callback(null, stdout.split('\n')[0]);
  });
}

exports.get_python_version = (callback) => {
  // Asks first if the device has python2, if it fails asks for python3
  cp.exec("python" + python_version + " || python3" + python_version, (err, stdout) => {
    if (err) return callback(err);

    callback(null, stdout.split('\n')[0]);
  })  
}