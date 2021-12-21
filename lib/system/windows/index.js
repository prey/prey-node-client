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
    paths   = require('./../paths'),
    exec    = cp.exec,
    spawn   = cp.spawn,
    os_name = process.platform.replace('win32', 'windows');

    const si = require('systeminformation');

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
    callback(!!bool);
  });
};

exports.get_os_name = function(callback) {
  callback(null, os_name);
};

exports.get_os_version = function(cb){
  var ver, release = os.release();

  if (!release || release.trim() == '')
    cb(new Error('Unable to determine Windows version.'));
  else
    cb(null, release.trim());
};

exports.find_logged_user = function(callback) {
  var common = require('./../../agent/common'),
      gte = common.helpers.is_greater_or_equal;

  var done = function(err, stdout) {
    if (err) return callback(err);

    var out = stdout.toString().split("\\"),
        user = clean_string(out[out.length-1]);

    if (!user  || user == '' || user == 'undefined')
      return callback(err || new Error('No logged user found.'));

    callback(null, user);
  }

  wmic.get_value('computersystem', 'username', null, function(err, wmiout) {
    if (err || wmiout.toString().trim() == '') {
      if (gte(common.os_release,'10.0.0')) {  // retry only for windows 10
        exec("powershell (Get-WmiObject -Class win32_computersystem).UserName", (err, psout) => {
          if (err || psout.toString().trim() == '')
            return done(err || new Error('No logged user found.'));

          return done(null, psout);
        })
      } else return done(err || new Error('No logged user found.'));

    } else return done(null, wmiout);
  });
};

exports.get_os_edition = (callback) => {
  if (os_name != "windows") return callback(new Error('Only for Windows'));
  
    var common = require('./../../agent/common'),
    gte = common.helpers.is_greater_or_equal;

    if (gte(common.os_release,"10.0.20000")) {//10.0.20000 is w11
      si.osInfo( (stdoutsi) => {
        if (stdoutsi.distro.toString().trim() == '')
        return callback( new Error('No edition found.'));

        var edition = stdoutsi.distro.split(" ").splice(3)[0];

        if (edition == "Business") edition = "Pro";

        callback(null,edition);
      })
    }
    else{
      wmic.get_value('os', 'caption', null, (err, stdout) => {
        if (err || stdout.toString().trim() == '')
          return callback(err || new Error('No edition found.'));
    
        var edition = stdout.split(" ").splice(3)[0];
    
        if (!edition  || edition == '')
        return callback(err || new Error('No edition found.'));
    
        if (edition == "Business") edition = "Pro";

        callback(null,edition);
      })

    }
 

}

exports.get_winsvc_version = function(callback) {
  var common = require('./../../agent/common'),
      gte = common.helpers.is_greater_or_equal;

  if (os_name != "windows" || !gte(common.os_release,'10.0.0'))
    return callback(null, null);

  exec(path.join(paths.install ,'wpxsvc.exe') + ' -winsvc=version', (err, stdout) => {
    if (err) return callback(null, null);
    var service_version = stdout.split('\n')[0];

    callback(null, service_version);
  });
}

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
    if (err) return cb(new Error("Admin service not available"), data);
    exports.monitoring_service_go = true;
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
    if (err) return cb(err);

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
    if (err) return cb(err);

    try {
      var data = JSON.parse(body)
    } catch (e) {
      return cb(new Error('Unable to parse action data'))
    }

    var out = data && data.output ? data.output : null;
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
      cb(lang);
    });
  } catch(e) {
    return cb(lang);
  }
}

exports.get_current_hostname = (callback) => {
  exec("hostname", (err, stdout) => {
    if (err) return callback(err);
    
    callback(null, stdout.split('\r\n')[0]);
  });
}

exports.get_python_version = (callback) => {
  // Not necessary for now...
  return callback(null, null);
}

function bin_path(executable) {
  return path.join(__dirname, 'bin', executable);
}
