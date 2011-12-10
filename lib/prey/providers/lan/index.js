//////////////////////////////////////////
// Prey LAN Info Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		exec = require('child_process').exec,
		Provider = require('../../provider'),
		Network = require('../network');

var Lan = function(){

	Provider.call(this);
	var self = this;
	this.name = 'lan';

	this.getters = [
		'active_nodes_list'
	];

	this.ip_regex = new RegExp(/((25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})\.){3}(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[0-9]{1,2})/);

	this.get_active_nodes_list = function(callback){

		var nodes = [];
		var skip = ['WORKGROUP', '..__MSBROWSE__.'];

		Network.get('active_network_interface', function(nic){

			var command = 'nmblookup -A ' + nic.broadcast_address;

			var child = exec(command, function(err, stdout, stderr){

				var lines = stdout.toString().split("\n");

				lines.forEach(function(line, i){

					var columns = line.trim().split(/\s+/);

					if(skip.indexOf(columns[0]) == -1 && columns[columns.length-1] == '<ACTIVE>'){

						var ip = self.get_ip_from_hostname(columns[0], function(ip){

							var node = {
								name: columns[0],
								ip_address: ip
							}

							if(skip.indexOf(columns[0]) == -1) {
								console.log("Added: " + util.inspect(node));
								nodes.push(node);
								skip.push(node.name);
							}

							self.check_if_ready(lines.length, nodes, callback);

						});

					} else {

						self.check_if_ready(lines.length, nodes, callback);

					}

				});

			});

		});

	};

	this.check_if_ready = function(len, nodes, callback){

		this.counter |= 0;

		if(++this.counter == len){
			console.log(nodes);
		}

	};

	this.get_ip_from_hostname = function(hostname, callback){

		var cmd = 'nmblookup ' + hostname;

		exec(cmd, function(err, stdout, stderr){

			var matches = stdout.toString().split("\n")[1].match(self.ip_regex);
			if(matches)
				callback(matches[0]);
			else
				callback(false);


		});

	}

}

util.inherits(Lan, Provider);
module.exports = new Lan();
