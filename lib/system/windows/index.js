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
    needle  = require('needle'),
    cp      = require('child_process'),
    exec    = cp.exec,
    spawn   = cp.spawn,
    os_name = process.platform.replace('win32', 'windows');

var LOCALHOST_ACTION = 'http://127.0.0.1:7739/action';
exports.monitoring_service_go = false;

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

exports.scan_networks = function(cb) {
  var cmd_path = bin_path('wlanscan.exe');

  try {
    var child = spawn(cmd_path, ['/triggerscan'], {});
    child.on('exit', function() {
      cb();
    });
  } catch(e) {
    return cb();
  }
}

exports.check_service = function(data, cb) {
  if (exports.monitoring_service_go) return cb(null, data);

  needle.get(LOCALHOST_ACTION, function(err, resp) {
    if (err) return cb(err, data);
    exports.monitoring_service_go = true;
    return cb(null, data);
  });
}

exports.run_as_admin = function(command, opts, cb) {
  var body = {
        action: command,
        key:    opts.key,
        token:  opts.token,
        opts:   opts.options
      };

  needle.post(LOCALHOST_ACTION, body, { json : true }, function(err, resp, body) {
    if (err) return cb(err);
    return cb(null);
  });
}

exports.get_lang = function(cb) {
  var lang = 'en',
      reg_path = path.join("hklm", "system", "controlset001", "control", "nls", "language"),
      cmd  = 'reg query ' + reg_path + ' /v Installlanguage';

  try {
    exec(cmd, function(err, stdout) {
      if (!err && stdout.includes('0C0A')) lang = 'es';
      cb(lang);
    });
  } catch(e) {
    return cb(lang);
  }
}

function bin_path(executable) {
  return path.join(__dirname, 'bin', executable);
}
