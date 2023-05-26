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
    si      = require('systeminformation'),
    paths   = require('./../paths'),
    exec    = cp.exec,
    spawn   = cp.spawn,
    os_name = os.platform().replace('win32', 'windows');
var LOCALHOST_ACTION   = 'http://127.0.0.1:7739/action',
    LOCALHOST_PROVIDER = 'http://127.0.0.1:7739/provider';


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
    if (typeof callback !== 'function')
      return;
    callback(!!bool);
  });
};
exports.get_os_name = function(callback) {
  if (typeof callback !== 'function')
    return;
  callback(null, os_name);
};
exports.get_os_version = function(cb){
  var release = os.release();
  if (!release || release.trim() == ''){
    if (typeof cb !== 'function')
      return;
    cb(new Error('Unable to determine Windows version.'));
  }
  else{
    if (typeof cb !== 'function')
      return;
    cb(null, release.trim());
  }
};
exports.find_logged_user = function(callback) {
  var done = function(err, stdout) {
    if (err) {
      if (typeof callback !== 'function')
        return;
      return callback(err);
    }
    var out = stdout.toString().split("\\"),
        user = clean_string(out[out.length-1]);
    if (!user  || user == '' || user == 'undefined') {
      if (typeof callback !== 'function')
        return;
      return callback(err || new Error('No logged user found.'));
    }
    callback(null, user);
  }
  wmic.get_value('computersystem', 'username', null, function(err, wmiout) {
    if (err || wmiout.toString().trim() == ''){
      var computerName = process.env['COMPUTERNAME']; 
      si.users((user) => {
        if(!computerName || !user || user.length === 0 || !user[0].user) return callback(new Error('No logged user found.'));
        let out = computerName + "\\" +user[0].user;
        return done(null, out);
      }) 
    } 
    else{
      return done(null, wmiout);
    }
  });
};
exports.get_os_edition = (callback) => {
  if (os_name != "windows") {
    if (typeof callback !== 'function')
      return;
    return callback(new Error('Only for Windows'));
  }
  var common = require('./../../agent/common'),
         gte = common.helpers.is_greater_or_equal;

  if (gte(common.os_release,"10.0.0")) { //10.0.20000 is w11 //10.0.0 is w10
    si.osInfo((stdoutsi) => {
      if (!stdoutsi || !stdoutsi.distro || stdoutsi.distro.toString().trim() == ''){
        if (typeof callback !== 'function')
          return;
        return callback(new Error('No edition found.'));
      }
      var edition = stdoutsi.distro.split(" ").splice(3)[0];
      if (edition == "Business") edition = "Pro";
      if (typeof callback !== 'function')
        return;
      callback(null,edition);
    })
  } else {
    wmic.get_value('os', 'caption', null, (err, stdout) => {
      if (err || stdout.toString().trim() == ''){
        if (typeof callback !== 'function')
          return;
        return callback(err || new Error('No edition found.'));
      }
      var edition = stdout.split(" ").splice(3)[0];
      if (!edition || edition == ''){
        if (typeof callback !== 'function')
          return;
        return callback(err || new Error('No edition found.'));
      }
      if (edition == "Business") edition = "Pro";
      if (typeof callback !== 'function')
        return;
      callback(null,edition);
    })
  }
}
exports.get_winsvc_version = function(callback) {
  var common = require('./../../agent/common'),
      gte = common.helpers.is_greater_or_equal;
  if (os_name != "windows" || !gte(common.os_release,'10.0.0')){
    if (typeof callback !== 'function')
      return;
    return callback(null, null);
  }
  exec(path.join(paths.install ,'wpxsvc.exe') + ' -winsvc=version', (err, stdout) => {
    if (err){
      if (typeof callback !== 'function')
        return;
      return callback(null, null);
    }
    var service_version = stdout.split('\n')[0];
    callback(null, service_version);
  });
}
exports.scan_networks = function(cb) {
  var cmd_path = bin_path('wlanscan.exe');
  try {
    var child = spawn(cmd_path, ['/triggerscan'], {});
    child.on('exit', function() {
      if (typeof cb !== 'function')
        return;
      cb();
    });
  } catch(e) {
    return cb();
  }
}
exports.check_service = function(data, cb) {
  if (exports.monitoring_service_go) {
    if (typeof cb !== 'function')
      return;
    return cb(null, data);
  }
  needle.get(LOCALHOST_ACTION, function(err, resp) {
    if (err) {
      if (typeof cb !== 'function')
        return;
      return cb(new Error("Admin service not available"), data);
    }
    exports.monitoring_service_go = true;
    if (typeof cb !== 'function')
      return;
    return cb(null, data);
  });
}
exports.get_as_admin = function(provider, cb) {
  var body = {
    provider: provider
  };
  var opts = {
    timeout: 90000,
    json: true
  };
  needle.post(LOCALHOST_PROVIDER, body, opts, function(err, resp, body) {
    if (err) {
      if (typeof cb !== 'function')
        return;
      return cb(err);
    }
    try {
      var data = JSON.parse(body)
    } catch (e) {
      return cb(new Error('Unable to parse provider data'))
    }
    var out = data && data.output ? data.output : null;
    return cb(null, out);
  });
}
exports.run_as_admin = function(command, opts, cb) {
  var body = {
        action: command,
        key:    opts.key,
        token:  opts.token,
        opts:   opts.dirs,
        optsKeep : opts.dir_keep
      };
  needle.post(LOCALHOST_ACTION, body, { json : true, timeout: 120000 }, function(err, resp, body) {
    if (err) {
      if (typeof cb !== 'function')
        return;
      return cb(err)
    }
    try {
      var data = JSON.parse(body)
    } catch (e) {
      if (typeof cb !== 'function')
        return;
      return cb(new Error('Unable to parse action data'))
    }
    var out = data && data.output ? data.output : null;
    if (typeof cb !== 'function')
      return;
    return cb(null, out);
  });
}
exports.get_lang = function(cb) {
  var lang = 'en',
      reg_path = path.join("hklm", "system", "controlset001", "control", "nls", "language"),
      cmd  = 'reg query ' + reg_path + ' /v Installlanguage';
  try {
    exec(cmd, function(err, stdout) {
      if (!err && stdout.includes('0C0A')) lang = 'es';
      if (typeof cb !== 'function')
        return;
      cb(lang);
    });
  } catch(e) {
    return cb(lang);
  }
}
exports.get_current_hostname = (callback) => {
  exec("hostname", (err, stdout) => {
    if (err) {
      if (typeof callback !== 'function')
        return;
      return callback(err);
    }
    if (typeof callback !== 'function')
        return;
    callback(null, stdout.split('\r\n')[0]);
  });
}
exports.get_python_version = (callback) => {
  if (typeof callback !== 'function')
        return;
  // Not necessary for now...
  return callback(null, null);
}
function bin_path(executable) {
  return path.join(__dirname, 'bin', executable);
}

exports.compatible_with_module_tpm = function (data) {
  var editions = ["Pro", "Education", "Enterprise"]; 
  var common = require('./../../agent/common'),
  gte = common.helpers.is_greater_or_equal;
  if (data.os_name == 'windows' && gte(os.release().trim(), "10.0.0") &&
      data.os_edition && editions.includes(data.os_edition) &&
      data.winsvc_version && gte(data.winsvc_version, "2.0.0"))
      return true;
  return false;
}