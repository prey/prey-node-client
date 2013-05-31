"use strict";

var common = require('./../../common'),
    wmic   = common.system.wmic,
    exec   = require('child_process').exec;

/**
 *
 **/
exports.get_remaining_storage = function(callback) {
  var cmd ="Logicaldisk where name='C:' get Size,Freespace";

  wmic.run(cmd, function(err, stdout){
    if (err) return callback(err);

    var cols = stdout.split("\n")[1].trim().split(/\s+/);

    var info = {
      size_gb: cols[0],
      free_gb: cols[1],
      used: ""+(cols[0] - cols[1])
    };

    callback(null, info);
  });
};

/**
 *
 **/
exports.get_battery_info = function(callback) {
  var cmd = '/Namespace:"\\\\root\\WMI" Path BatteryStatus ' +
        'get Charging,Critical,Discharging,Poweronline,RemainingCapacity';

  wmic.run(cmd, function(err, stdout) {
    if (err) return callback(err);

    var cols = stdout.split("\n")[1].trim().split(/\s+/);
    var state;
    if (cols[0] === 'TRUE') {
      state = 'Charging';
    }
    else if (cols[1] === 'TRUE') {
      state = 'Critical';
    }
    else if (cols[2] === 'TRUE') {
      state = 'Discharging';
    }
    else if (cols[3] === 'TRUE') {
      state = 'Connected';
    }
    else {
      state = "Not present";
    }

    var data = {
      percentage_remaining: parseInt(cols[4]),
      time_remaining: null, // TODO
      state: state
    };

    callback(null,data);
  });

};
