"use strict";

var
    os_name = _ns('common').os_name,
    exec = require('child_process').exec;

/**
 * 
 **/
exports.get_outbound_connections_list = function(callback) {
  var connections = [],command;
	if(os_name === 'mac')
		command = '/usr/sbin/netstat -p tcp -a | grep -v "localhost\."';
	else
		command = 'netstat -tupn | grep -v "127.0.0.1"';

	exec(command, function(err, stdout){
		if(err) return callback(_error("!:"+command,err));

		stdout.toString().split("\n").forEach(function(line){
			var columns = line.trim().split(/\s+/);
			if(columns[0] === 'tcp' || columns[0] === 'tcp4' || columns[0] === 'udp') {
				var connection = {
					protocol: columns[0],
					recv: columns[1],
					send: columns[2],
					local_address: columns[3],
					remote_address: columns[4],
					state: columns[5]
				};
				if(columns[6]){
					connection.program_pid = columns[6].split('/')[0];
					connection.program_name = columns[6].split('/')[1];
				}
				connections.push(connection);
			}
		});

		callback(null, connections);
	});
};
