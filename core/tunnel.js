//////////////////////////////////////////
// Prey JS Tunnel Object
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var net = require('net'),
		tls = require('tls'),
		fs = require('fs'),
		util = require('util');

var private_key_file = 'ssl/ssl.key';
var certificate_file = 'ssl/ssl.cert';

var Tunnel = function(local_port, remote_host, remote_port){

	var self = this;

	var local_socket;
	var remote_socket;

	this.connectionClosed = function(socket, had_error){
		if(had_error){
			console.log("Connection closed due to error.");
		} else{
			console.log("Connection closed.");
		}
	};

	this.connectionEnded = function(socket){
		console.log("Stream ended.");
		if(socket.readyState != 'closed'){
			// console.log("Destroying connection...");
			// socket.destroy();
		}
	};

	this.start = function(){

		var keys = {
			key: fs.readFileSync(private_key_file).toString(),
			cert: fs.readFileSync(certificate_file).toString()
		};

		remote_socket = new net.Socket();
		local_socket = new net.Socket();

		// create and encrypted connection using ssl
		remote_socket = tls.connect(remote_port, remote_host, keys, function(){

			console.log(" -- Connection established.");

			if (remote_socket.authorized)
				console.log(" -- Credentials were valid!")
			else
				console.log(" !! Credentials were NOT valid: " + remote_socket.authorizationError);

		});

		local_socket.on('connect', function(){
			console.log("local connected");
		})

		remote_socket.on("data", function(data) {

			console.log("Remote sent: " + data);
			console.log("Local socket state: " + local_socket.readyState);

			if(data == "stop"){

				local_socket.end();

			} else if(local_socket.readyState == "closed"){

				local_socket.connect(local_port);
				console.log("Local tunnel connected to " + local_port);

			} else {

				local_socket.write(data);
			}

		});

		local_socket.on("error", function(e) {
			console.log("Error!");
			console.log(e);
			// local_socket.end();
			remote_socket.end(e.code); // sends and ends
		});

		local_socket.on("data", function(data) {
			console.log("Local sent: " + data);
			remote_socket.write(data);
		});

		remote_socket.on("end", function() {
			console.log("Remote socket ended.");
			self.connectionEnded(remote_socket);
			// local_socket.end();
		});

		local_socket.on("end", function() {
			console.log("Local socket ended.");
			self.connectionEnded(local_socket);
			// remote_socket.end();
		});

		remote_socket.on("close", function(had_error) {
			console.log("Remote socket closed.");
			self.connectionClosed(remote_socket, had_error);
		});

		local_socket.on("close", function(had_error) {
			console.log("Local socket closed.");
			self.connectionClosed(local_socket, had_error);
		});

	}

};

module.exports = Tunnel;
