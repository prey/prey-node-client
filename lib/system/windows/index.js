"use strict";

//////////////////////////////////////////
// Prey Node.js Windows Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var path    = require('path'),
    wmic    = require('./wmic'),
    // netsh   = require('./netsh'),
    os      = require('os'),
    exec    = require('child_process').exec,
    os_name = process.platform.replace('win32', 'windows');

exports.wmic = wmic;

// add windows bin path to env
process.env.PATH = process.env.PATH + ';' + path.join(__dirname, 'bin');

exports.process_running = function(process_name, callback){
  var cmd = 'tasklist /fi "imagename eq ' + process_name + '"';
  exec(cmd, function(err, stdout){
    callback(stdout && stdout.toString().indexOf(process_name) !== -1);
  });
};

/**
 *
 **/
exports.get_os_version = function(cb){

  var ver, release = os.release();

  if (!release || release.trim() == '')
    cb(new Error('Unable to determine Windows version.'));

  var float = parseFloat(release);

  [
    [ '8'     , 6.2 ],
    [ '7'     , 6.1 ],
    [ 'Vista' , 6.0 ],
    [ 'XP_64' , 5.2 ],
    [ 'XP'    , 5.1 ],
    [ '2000'  , 5.0 ],
    [ 'Me'    , 4.9 ],
    [ '98'    , 4.1 ]
  ].forEach(function(arr){
    if (!ver && float >= arr[1])
      ver = arr[0];
  })

  if (ver)
    cb(null, ver);
  else
    cb(new Error('Unable to determine Windows version.'))
};

/**
 *
 **/
exports.get_logged_user = function(callback) {
  wmic.run('computersystem get username', function(err, stdout) {
    if (err || stdout.toString().trim() == '')
      return callback(err || new Error('No logged user found.'));

    var out = stdout.toString().split("\\");

    callback(null, out[out.length-1].trim());
  });
};

/**
 *
 **/
exports.get_os_name = function(callback){
  callback(null, os_name);
};

exports.auto_connect = function(callback){

  var release = os.release();
  if (parseFloat(release) >= 6.0) { // vista or higher
    // netsh.reconnect(callback);
  } else {
    var cmd_path = path.join(__dirname, 'bin', 'autowc.exe');
    exec(cmd_path + ' -connect', callback);
  }
};
