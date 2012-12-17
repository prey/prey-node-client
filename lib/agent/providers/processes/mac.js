"use strict";

var exec = require('child_process').exec;

exports.get_process_list = function(callback) {

  var processes = [],
      cmd = 'ps axo stat,user,ppid,pid,pcpu,pmem,time,comm | egrep -v " ps|grep"';

  var child = exec(cmd, function(err, stdout){
    if (err) return callback(err);

    stdout.toString().split("\n").forEach(function(line){

      var columns = line.trim().split(/\s+/);
      if (columns[0] !== '' && columns[columns.length] !== '<defunct>'){

        var process = {
          status: columns[0],
          user:   columns[1],
          ppid:   parseInt(columns[2]),
          pid:    parseInt(columns[3]),
          cpu:    columns[4],
          mem:    columns[5],
          time:   columns[6],
          name:   columns[7]
        };

        // don't add the id for this prey process
        if (process.pid !== child.pid)
          processes.push(process);
      }
    });

    processes.sort(function(a,b){
      return (a.pid > b.pid);
    });

    callback(null, processes);
  });
};
