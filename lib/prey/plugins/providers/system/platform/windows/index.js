
"use strict";

var
  wmic = _ns('windows').wmic,
  common = _ns('common'),
  exec = require('child_process').exec;

/**
 * 
 **/
exports.get_os_version = function(callback){
  exec('ver', function(err, stdout){
    if (err) return callback(_error('!:ver',err));
    
    var out = stdout.toString().trim();
    if (out.indexOf('2000') !== -1)
      callback(null,'2000');
    else if(out.indexOf('XP') !== -1)
      callback(null,'XP');
    else if (out.indexOf('Vista') !== -1)
      callback(null,'Vista');
    else if (out.indexOf(' 7 ') !== -1)
      callback(null,'7');
  });
};

/**
 * 
 **/
exports.get_logged_user = function(callback) {
  var cmd = "computersystem get username";
  wmic.run(cmd,function(err,stdout) {
    if (err) return callback(_error('!:'+cmd,err));

    callback(null,stdout.toString().split("\n")[1]);
  });
};

/**
 * 
 **/
exports.get_os_name = function(callback){
  callback(null,common.os_name);   
};

/**
 * 
 **/
exports.get_remaining_storage = function(callback) {
  var cmd ="Logicaldisk where name='C:' get Size,Freespace";
  wmic.run(cmd, function(err, stdout){
    if (err) return callback(_error('!:'+cmd,err));

    var cols = stdout.split("\n")[1].trim().split(/\s+/),
        info = {size_gb: cols[0], free_gb: cols[1], used: ""+(cols[0] - cols[1]) };
    
    console.log(require('util').inspect(info));
    callback(null, info);
  });
};

/**
 *
 **/
exports.get_battery_info = function(callback) {
  var cmd = '/Namespace:"\\\\root\\WMI" Path BatteryStatus ' +
        'get Charging,Critical,Discharging,Poweronline,RemainingCapacity';

  wmic.run(cmd,function(err,stdout) {
    if (err) return callback(_error('!:'+cmd,err));

    var cols = stdout.split("\n")[1].trim().split(/\s+/);
    var state ;
    if (cols[0] === 'TRUE')
      state = 'Charging';
    if (cols[1] === 'TRUE')
      state = 'Critical';
    if (cols[2] === 'TRUE')
      state = 'Discharging';
    if (cols[3] === 'TRUE')
      state = 'Poweronline';

    var data = {
      percentage_remaining: parseInt(cols[4]),
      time_remaining: null, // TODO
      state: state
    };

    callback(null,data);
  });

};

