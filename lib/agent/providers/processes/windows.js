"use strict";

var wmic = require('./../../common').system.wmic;

/**
  * Callsback an array of processes.
  *
 **/

// NOTE: Not sure if UserModeTime is correct here of if need to add KernelModeTime too.

exports.get_process_list = function(callback) {
  var query = 'path Win32_Process get Caption,ParentProcessId,ProcessId,UserModeTime';

  wmic.run(query, function(err, out, wmic_pid) {
    if (err) return callback(err);

    callback(null, out.split(/\n/)
     .filter(function(line) {
       // TODO: probably locale fubar on System Idle Process
       return line.length > 1 && line.indexOf("System Idle Process") === -1;
    })
     .splice(1)
     .map(function(line) {

       var fields = line.split(/\s+/),
           pid = parseInt(fields[2]);

       if (pid === wmic_pid) return null;

       return  {
         name: fields[0],
         ppid: fields[1],
         pid:  pid,
         time: fields[3]
       };

     })
     .filter(function(obj) { return obj !== null; }));
  });
};
