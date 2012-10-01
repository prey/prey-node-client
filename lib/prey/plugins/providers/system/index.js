//////////////////////////////////////////
// Prey JS System Module
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

"use strict";

var common = _ns('common'),
    os = require('os'),
    exec = require('child_process').exec,
    os_functions = require('./platform/' + common.os_name);

var System = function(){

  /**
   * Callsback name of currently logged in user.
   **/
  this.get_logged_user = function(callback){
    if (process.env.LOGGED_USER) return callback(null, process.env.LOGGED_USER);

    os_functions.get_logged_user(function(err,user_name) {
      if (err) return callback(_error(err));

      if(user_name && user_name !== '')
        callback(null, user_name);
      else
        callback(_error('No logged user'));
    });    
  };

  /**
   * Callsback current uptime in seconds.
   **/
  this.get_uptime = function(callback){
    callback(null, parseInt(os.uptime()));
  };

  /**
   * Callsback percentage of battery remaining in integer: ('80%' -> 80)
   **/
  this.get_remaining_battery = function(callback){
    os_functions.get_battery_info(function(err, data){
      if (err) return callback(_error(err));

      callback(null, data.percentage_remaining + '%');
    });
  };

  /**
   * Callsback object with last_min, last_five and last_fifteen fields of load
   **/  
  this.get_cpu_load = function(callback){
    var data = os.loadavg();
    var info = { last_min: data[0], last_five: data[1], last_fifteen: data[2] };
    callback(null, info);
  };

  this.get_memory_usage = function(callback) {
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
   * Callsback the os name in proper case
   **/
  this.get_os_name = function(callback) {
    os_functions.get_os_name(callback);
  };

  /**
   * Callsback the version of the os.
   **/
  this.get_os_version = function(callback){
    os_functions.get_os_version(callback);
  };

  
  /**
   * Callsback an object with fields size_gb, free_gb, used
   **/
  this.get_remaining_storage = function(callback){
    os_functions.get_remaining_storage(callback);
  };

};

module.exports = new System();
