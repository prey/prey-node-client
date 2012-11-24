"use strict";

var wmic = require('./../../common').system.wmic;

/**
  * Callsback an array of processes.
  *
 **/
exports.get_process_list = function(callback) {
  var query = 'path Win32_Process get Caption,ParentProcessId,ProcessId,UserModeTime';

  // NOTE: Not sure if UserModeTime is correct here of if need to add KernelModeTime too.

  wmic.run(query,function(err,out, wmicPid) {
    if (err) return callback(err);

    callback(null,out.split(/\n/)
     .filter(function(line) {
      // TODO: probably locale fubar on System Idle Process
      return line.length > 1 && line.indexOf("System Idle Process") === -1;
    })
     .splice(1)
     .map(function(line) {
       var flds = line.split(/\s+/) ;
       var pid = parseInt(flds[2]);
       if (pid === wmicPid) return null;
       return  {
         name:flds[0],
         ppid:flds[1],
         pid:pid,
         time:flds[3]
       };
     })
     .filter(function(obj) { return obj !== null; }));
  });
};
