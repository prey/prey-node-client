//////////////////////////////////////////
// Prey Process List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		exec = require('child_process').exec,
		os_name = require('./../../../common').os_name,
		Getters = require('./../../../getters');

var Connections = function(){

	Getters.call(this);
	var self = this;
	// this.name = 'connections';

	this.getters = [
		'outbound_connections_list'
	];

	this.get_outbound_connections_list = function(callback){

		var connections = [];
		if(os_name == 'mac')
			var command = '/usr/sbin/netstat -p tcp -a | grep -v "localhost\."';
		else
			var command = 'netstat -tupn | grep -v "127.0.0.1"';

		var child = exec(command, function(err, stdout, stderr){
			
			if(err) return callback(err);

			stdout.toString().split("\n").forEach(function(line){

				var columns = line.trim().split(/\s+/);
				// console.log(columns);

				if(columns[0] == 'tcp' || columns[0] == 'tcp4' || columns[0] == 'udp') {

					var connection = {
						protocol: columns[0],
						recv: columns[1],
						send: columns[2],
						local_address: columns[3],
						remote_address: columns[4],
						state: columns[5]
					}
					
					if(columns[6]){
						connection.program_pid = columns[6].split('/')[0];
						connection.program_name = columns[6].split('/')[1];
					}

					// console.log(connection);
					connections.push(connection);

				}

			});

			callback(null, connections);

		});

	};

}

util.inherits(Connections, Getters);
module.exports = new Connections();
