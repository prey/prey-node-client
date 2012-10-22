
"use strict";

var
  exec = require('child_process').exec,
  fs = require('fs'),
  helpers = _ns('helpers');

/**
 * Callsback an array of {name,tty}, users currently logged in 
 **/
exports.get_tty_users = function(callback) {
  var cmd = "w -h | awk '{print $1,$2}'";
  exec(cmd,function(err,stdout) {
    if (err) return callback(_error("!:"+cmd,err));

    callback(null,stdout.trim().split('\n').map(function(l) {
      var s = l.split(" ");
      return {name:s[0],tty:s[1]};
    }));
  });
};

/**
 *  Callsback the user logged in on main tty
 **/
exports.get_logged_user = function(callback) {
  exports.get_tty_users(function(err,utty) {
    if (err) return callback(_error(err));

    var ttyOnly = utty.filter(function(el) { return el.tty.substr(0,3) === 'tty'; });
    if (ttyOnly.length === 0)
      return callback(_error('no logged in user'));

    callback(null,ttyOnly[0].name);
  });
};

exports.get_os_name = function(callback){
  var cmd = 'lsb_release -i';
  exec(cmd, function(err, stdout){
    if(err) return callback(_error("!:" + cmd,err));
    
    callback(null,stdout.toString().split(":")[1].trim());  
  });
};

exports.get_os_version = function(callback){
  var cmd = 'lsb_release -r';
  exec(cmd, function(err, stdout){
    if(err) return callback(_error("!:" + cmd, err));
    
    callback(null, stdout.toString().split(':')[1].trim());
  });
};

var battery_fallback = function(callback) {
  var battery_path = '/proc/acpi/battery/BAT0',
      cmd  ='cat ' + battery_path + '/state';

  fs.exists(battery_path,function(exists) {
    if (!exists) return callback(_error("!:Battery Fallback",battery_path+' does not exist'));
    
    exec(cmd, function(err, stdout) {
      if(err) return callback(_error('!:'+cmd,err));

      var output = stdout.toString(),
      remaining = output.match(/remaining capacity:\s+(\d+)/)[1],
      state = output.match(/charging state:\s+(\w+)/)[1],
      cmdInfo = 'cat ' + battery_path + '/info';

      exec(cmdInfo, function(err, stdout){
        if(err) return callback(_error("!:"+cmdInfo, err));

        var full = stdout.toString().match(/last full capacity:\s+(\d+)/)[1];

        var data = {
          percentage_remaining: parseInt(remaining) * 100 / parseInt(full),
          time_remaining: null, // TODO
          state: state
        };

        callback(null, data);
      });
    });
  });
};

/**
 * Try upower, then fallback to /proc/acpi if upower does not exist.
 **/
exports.get_battery_info = function(callback){
  var cmd = 'upower --dump';
  exec(cmd,function(err,stdout) {
    if (err) {
      if (err.code === 127) { // command not found
        return battery_fallback(callback);
      } else {
        return callback(_error("!:"+cmd,err));
      }
    }
    // parse upower output ..
    callback(null,_.chain(stdout.split('\n\n')).map(function(block) {
      return block.split('\n');
    }).filter(function(blockarray) {
      return blockarray[0].match(/battery_BAT0/);
    })
    .flatten()
    .reduce(function(o,el) {
      var m = el.match(/(percentage|state):\s+(\S+)/);
      if (m) {
        if (m[1] === "percentage")
          o.percentage_remaining = m[2];
        else
          o[m[1]] = m[2]; // o.state = 
      }
      return o;
    },{time_remaining:null}).value());
  });
};

exports.get_remaining_storage = function(callback) {
  var cmd = "df -kh / | tail -1";
  exec(cmd, function(err, stdout){
    if (err) return callback(_error('!:'+cmd,err));
    
    var data = stdout.toString().trim().split(/\s+/);
    var info = {size_gb: data[1], free_gb: data[3], used: data[4] };
    callback(null, info);
  });
};
