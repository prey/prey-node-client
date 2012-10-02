"use strict";

var wmic = _ns('wmic');
     
/**
  Callsback a nic name.
 **/
exports.get_process_list = function(callback) {
  var query = 'path Win32_Process get Caption,ParentProcessId,ProcessId,UserModeTime';
  
  wmic.run(query,function(err,out) {
    if (err) return callback(_error("!:"+query,err));

    callback(null,out.split(/\n/)
             .filter(function(line) {
               return line.length > 1
                     && line.indexOf("System Idle Process") ===-1 }) // probably locale fubar
             .splice(1)
             .map(function(line) {
               var flds = line.split(/\s+/) ;
               return  {
                 name:flds[0],
                 ppid:flds[1],
                 pid:flds[2],
                 time:flds[3]
               };
             }));
  });
};

