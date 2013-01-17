"use strict";

var exec = require('child_process').exec;

/**
 *
 **/
exports.get_outbound_connections_list = function(callback) {

  var connections = [],
      command = 'netstat -p tcp -n';

  exec(command, function(err, stdout){
    if (err) return callback(err);

    stdout.toString().split("\n").splice(2).forEach(function(line){

      var state, pid, columns = line.trim().split(/\s+/);
      if (columns.length < 2) return;

      var connection = {
        protocol: columns[0],
        recv: columns[1],
        send: columns[2],
        local_address: columns[3].replace(/\.(\d+)$/, ":$1"),
        remote_address: columns[4].replace(/\.(\d+)$/, ":$1"),
        state: columns[5],
        program_pid: null,
        program_name: null
      };

      connections.push(connection);
    });

    callback(null, connections);
  });
};
