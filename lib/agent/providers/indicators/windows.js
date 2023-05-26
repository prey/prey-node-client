"use strict";
var wmic   = require('wmic'),
    si      = require('systeminformation'),
    common = require('./../../../agent/common'),
    gte = common.helpers.is_greater_or_equal;

/**
 *
 **/
exports.get_remaining_storage = function(cb) {
  var cmd ="Logicaldisk where name='C:' get Size,Freespace";

  wmic.run(cmd, function(err, stdout){
    if (err) return cb(err);

    var cols = stdout.split("\n")[1].trim().split(/\s+/);

    var info = {
      total_gb: cols[0],
      free_gb : cols[1],
      used    : (cols[0]/cols[1])*100
    };

    cb(null, info);
  });
};

/**
 *
 **/
exports.get_battery_status = function(cb) {

  var keys = 'Availability,BatteryStatus,EstimatedChargeRemaining,EstimatedRunTime';

  var get_state = function(num) {
    if (num == 1)
      return 'discharging';
    else if (num == 2 || num == 3)
      return 'charged';
    else if (num == 5)
      return 'critical';
    else
      return 'charging';
  }

  var get_state_battery = function(battery) {
    if (battery.isCharging) {
      return 'charging';
    }
    if (!battery.isCharging && battery.percent < 100) {
      return 'discharging';
    }
    if (battery.percent == 100) {
      return 'charged';
    } 
  }
    wmic.get_values('Path Win32_Battery', keys, null, function(err, obj) {
      if (err) {
        si.battery((memory) => {
          var data = {
            percentage_remaining: parseInt(memory.percent),
            state: get_state_battery(memory),
            time_remaining: memory.timeRemaining || 'unknown'
          }
          cb(null, data);
        }) 
      }
      else{
        if (obj.Availability == '11')
        return cb(new Error('No battery found.'))
  
        var data = {
          percentage_remaining: parseInt(obj.EstimatedChargeRemaining),
          state: get_state(parseInt(obj.BatteryStatus)),
          time_remaining: obj.EstimatedRunTime || 'unknown'
        }
    
        cb(null, data);
      }
    }); 

};
