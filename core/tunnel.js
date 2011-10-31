//////////////////////////////////////////
// Prey JS Tunnel Object
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var net = require('net'),
		tls = require('tls'),
		util = require('util');

var Tunnel = function(local_port, remote_host, remote_port){

	var self = this;

	var local_socket;
	var remote_socket;

	this.start = function(){

		remote_socket = new net.Socket();
		local_socket = new net.Socket();

		console.log("Opening connection to " + remote_host + " at port " + remote_port);
		remote_socket.connect(remote_port, remote_host);

		remote_socket.on('connect', function(){
			console.log("connected to remote");
		})

		local_socket.on('connect', function(){
			console.log("local connected");
		})

		remote_socket.on("data", function(data) {

			console.log("Remote sent: " + data);

			if(local_socket.readyState == "closed"){

				try {
					local_socket.connect(local_port);
					console.log("Local tunnel connected to " + local_port);
				} catch(e) {
					console.log(e);
					console.log("Couldn't connect to " + local_port);
				}

			} else {
				local_socket.write(data);
			}

		});

		local_socket.on("data", function(data) {
			console.log("Local sent: " + data);
			remote_socket.write(data);
		});

		remote_socket.on("end", function(data) {
			local_socket.end();
		});

		local_socket.on("end", function(data) {
			remote_socket.end();
		});

	}

};

module.exports = Tunnel;
