"use strict";

var exec = require('child_process').exec;

/**
 *
 **/
exports.get_outbound_connections_list = function(callback) {

  var connections = [],
      command = 'netstat -ano';

  exec(command, function(err, stdout){
    if (err) return callback(err);

    stdout.toString().split("\n").splice(4).forEach(function(line){

      var state, pid, columns = line.trim().split(/\s+/);

      if (columns[0] === 'TCP' || columns[0] === 'TCP4' || columns[0] === 'UDP') {

        if (columns.length === 5) {
          state = columns[3];
          pid   = columns[4];
        } else {
          pid   = columns[3];
          state = "Unknown";
        }

        var connection = {
          protocol: columns[0],
          recv: null,
          send: null,
          local_address: columns[1],
          remote_address: columns[2],
          state: state,
          program_pid: pid,
          program_name: null
        };

        connections.push(connection);
      }

    });

    callback(null, connections);
  });
};
