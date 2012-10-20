
"use strict";

var
  exec = require('child_process').exec,
  fs = require('fs');

// exports.get_logged_user_cmd = "who | cut -d' ' -f1 | tail -1";

exports.get_logged_user = function(callback) {
  // whoami instead?? 
  var cmd = "ps aux | grep ssh-agent | cut -d' ' -f1 | head -1";
  exec(cmd, function(err, stdout){
    if (err) return callback(_error('!:'+cmd,err));

    callback(null,stdout.toString().trim());
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

exports.get_battery_info = function(callback){
  var cmd = 'upower --dump';
  exec(cmd,function(err,stdout) {
    if (err) {
      if (err.code === 127) { // command not found
        return battery_fallback(callback);
      } else {
        return callback("!:"+cmd,err);
      }
    }
    // parse upower output ..
    callback(null,stdout.split('\n\n').map(function(block) {
      return block.split('\n');
    }).filter(function(blockarray) {
      return blockarray[0].match(/battery_BAT0/);
    }).flatten()
    .reduce(function(o,el) {
      var m = el.match(/(percentage|state):\s+(\S+)/);
      if (m) {
        o[m[1]] = m[2];
      }
      return o;
    },{time_remaining:null}));
    
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
