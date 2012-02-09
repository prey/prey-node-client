//////////////////////////////////////////
// Prey Process List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		exec = require('child_process').exec,
		Provider = require('./../../../provider');

var Connections = function(){

	Provider.call(this);
	var self = this;
	// this.name = 'connections';

	this.getters = [
		'outbound_connections_list'
	];

	this.get_outbound_connections_list = function(callback){

		var connections = [];
		var command = 'netstat -tupn | grep -v "127.0.0.1"';

		var child = exec(command, function(err, stdout, stderr){

			stdout.toString().split("\n").forEach(function(line){

				var columns = line.trim().split(/\s+/);

				if(columns[0] == 'tcp' || columns[0] == 'udp') {

					var connection = {
						protocol: columns[0],
						recv: columns[1],
						send: columns[2],
						local_address: columns[3],
						remote_address: columns[4],
						state: columns[5],
						program_pid: columns[6].split('/')[0],
						program_name: columns[6].split('/')[1]
					}

					// console.log(connection);
					connections.push(connection);

				}

			});

			if(callback) callback(connections);

		});

	};

}

util.inherits(Connections, Provider);
module.exports = new Connections();
