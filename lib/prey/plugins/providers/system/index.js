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
 * Callsback name of currently logged in user.
 **/
exp.get_logged_user = helpers.report(function(callback){
  if (process.env.LOGGED_USER) return callback(null, process.env.LOGGED_USER);

  os_functions.get_logged_user(function(err,user_name) {
    if (err) return callback(_error(err));

    if(user_name && user_name !== '')
      callback(null, user_name);
    else
      callback(_error('No logged user'));
  });    
});

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
 * Callsback the os name in proper case
 **/
exp.get_os_name = os_functions.get_os_name;

/**
 * Callsback the version of the os.
 **/
exp.get_os_version = os_functions.get_os_version;

/**
 * Callsback an object with fields size_gb, free_gb, used
 **/
exp.get_remaining_storage = helpers.report(function(callback){
  os_functions.get_remaining_storage(callback);
});


