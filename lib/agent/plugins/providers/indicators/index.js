//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

"use strict";

var
  common = _ns('common'),
  os = require('os'),
  os_functions = require('./platform/' + common.os_name),
  helpers = _ns('helpers'),
  exp = module.exports;

/**
 * Callsback current uptime in seconds.
 **/
exp.get_uptime = helpers.report(function(callback){
  callback(null, parseInt(os.uptime()));
});

/**
 * Callsback percentage of battery remaining in integer: ('80%' -> 80)
 **/
exp.get_remaining_battery = helpers.report(function(callback){
  os_functions.get_battery_info(function(err, data){
    if (err) return callback(_error(err));

    callback(null, data.percentage_remaining + '%');
  });
});

/**
 * Callsback object with last_min, last_five and last_fifteen fields of load
 **/
exp.get_cpu_load = helpers.report(function(callback){
  var data = os.loadavg();
  var info = { last_min: data[0], last_five: data[1], last_fifteen: data[2] };
  callback(null, info);
});

exp.get_memory_usage = helpers.report(function(callback) {
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
});


/**
 * Get battery info.
 **/
exp.get_battery_info = os_functions.get_battery_info;

/**
 * Callsback an object with fields size_gb, free_gb, used
 **/
exp.get_remaining_storage = helpers.report(function(callback){
  os_functions.get_remaining_storage(callback);
});
