//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

"use strict";

var
  os = require('os'),
  os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
  os_functions = require('./' + os_name);

/**
 * Callsback current uptime in seconds.
 **/
exports.get_uptime = function(callback){
  callback(null, parseInt(os.uptime()));
};

/**
 * Callsback percentage of battery remaining in integer: ('80%' -> 80)
 **/
exports.get_remaining_battery = function(callback){
  os_functions.get_battery_info(function(err, data){
    if (err || !data)
      return callback(err || new Error("Couldn't read battery status."));

    callback(null, data.percentage_remaining + '%');
  });
};

/**
 * Callsback object with last_min, last_five and last_fifteen fields of load
 **/
exports.get_cpu_load = function(callback){
  var data = os.loadavg();

  var info = {
    last_min: data[0],
    last_five: data[1],
    last_fifteen: data[2]
  };

  callback(null, info);
};

exports.get_memory_usage = function(callback) {
  var trimInt = function(number, len){
    return number.toString().substring(0, len || 4);
  };

  var mem_usage = {
    total_bytes: os.totalmem(),
    free_bytes: os.freemem(),
    used: 100 - trimInt(os.freemem()*100/os.totalmem()) + '%'
  };
  // mem_usage.used = 100 - parseFloat(mem_usage.remaining) + '%';

  callback(null, mem_usage);
};

/**
 * Get battery info.
 **/
exports.get_battery_info = os_functions.get_battery_info;

/**
 * Callsback an object with fields size_gb, free_gb, used
 **/
exports.get_remaining_storage = os_functions.get_remaining_storage;
