
"use strict";

var exec = require('child_process').exec;

// exports.get_logged_user_cmd = "who | cut -d' ' -f1 | tail -1";

exports.get_logged_user = function(callback) {
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
    
    callback(null,stdout.toString().split(":")[1]);   
  });
};

exports.get_os_version = function(callback){
  var cmd = 'lsb_release -r';
  exec(cmd, function(err, stdout){
    if(err) return callback(_error("!:" + cmd, err));
    
    callback(null, stdout.toString().split(':')[1].trim());
  });
};

exports.get_battery_info = function(callback){
  var battery_path = '/proc/acpi/battery/BAT0',
      cmd  ='cat ' + battery_path + '/state';

  exec(cmd, function(err, stdout){

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
