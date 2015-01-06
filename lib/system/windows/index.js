"use strict";

//////////////////////////////////////////
// Prey Node.js Windows Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var path    = require('path'),
    wmic    = require('wmic'),
    os      = require('os'),
    exec    = require('child_process').exec,
    os_name = process.platform.replace('win32', 'windows');

// add windows bin path to env
process.env.PATH = process.env.PATH + ';' + path.join(__dirname, 'bin');

var clean_string = function(str){
  return str.replace(/[^A-Za-z0-9\s]/g, '_').trim();
}

exports.process_running = function(process_name, callback){
  var cmd = 'tasklist /fi "imagename eq ' + process_name + '"';
  exec(cmd, function(err, stdout) {
    var bool = stdout && stdout.toString().indexOf(process_name) !== -1;
    callback(!!bool);
  });
};

exports.get_os_version = function(cb){
  var ver, release = os.release();

  if (!release || release.trim() == '')
    cb(new Error('Unable to determine Windows version.'));
  else
    cb(null, release.trim());
};

exports.find_logged_user = function(callback) {
  wmic.get_value('computersystem', 'username', null, function(err, stdout) {
    if (err || stdout.toString().trim() == '')
      return callback(err || new Error('No logged user found.'));

    var out = stdout.toString().split("\\"),
        user = clean_string(out[out.length-1]);

    callback(null, user);
  });
};

exports.get_os_name = function(callback) {
  callback(null, os_name);
};

exports.reconnect = function(cb) {
  var cmd_path = path.join(__dirname, 'bin', 'autowc.exe');
  exec('"' + cmd_path + '" -connect', cb);
};
