"use strict";

//////////////////////////////////////////
// Prey Node.js Windows Client Functions
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../common'),
    path   = require('path'),
    wmic   = require('./wmic'),
    os     = require('os'),
    exec   = require('child_process').exec;

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
exports.get_os_version = function(callback){

  var ver = 'Unknown',
      release = os.release();

  if (release == '5.00.2195')
    ver = '2000';
  else if (release == '5.1.2600')
    ver = 'XP';
  else if (release == '6.0')
    ver = 'Vista';
  else if (release == '6.1')
    ver = '7';

  cb(null, ver);
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
  callback(null, common.os_name);
};

exports.auto_connect = function(callback){
  var cmd_path = path.join(__dirname, 'bin', 'autowc.exe');
  exec(cmd_path + ' -connect', callback);
};
