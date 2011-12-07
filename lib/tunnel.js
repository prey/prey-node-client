//////////////////////////////////////////
// Prey JS Tunnel Object
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var logger = require('./common').logger,
		net = require('net'),
		tls = require('tls'),
		fs = require('fs'),
		emitter = require('events').EventEmitter,
		util = require('util');

// openssl genrsa -out ssl.key 2048
// openssl req -new -key ssl.key -out ssl.csr
// openssl x509 -req -in ssl.csr -signkey ssl.key -out ssl.cert

var private_key_file = 'ssl/ssl.key';
var certificate_file = 'ssl/ssl.cert';

var Tunnel = function(local_port, remote_host, remote_port){

	var self = this;

	this.local_socket = null;
	this.remote_socket = null;
	this.status = null;

	this.log = function(str){
		logger.info(' -- [tunnel] ' + str);
	};

	this.connectionEnded = function(socket){
		self.log("Stream ended.");
		if(socket.readyState != 'closed'){
			self.log("Destroying connection...");
			socket.destroy();
		}
	};

	this.closed = function(){
		if(this.status == 'closed') return;
		this.status = 'closed';
		this.emit('closed');
	};

	this.opened = function(){
		if(this.is_open()) return;
		this.status = 'open';
		this.emit('opened');
	};

	this.is_open = function(){
		return this.status == 'open';
	};

	this.close = function(){

		if(this.local_socket.readyState != 'closed'){
			self.log("Closing local end...");
			this.local_socket.destroy();
		}
		if(this.remote_socket.readyState != 'closed'){
			self.log("Closing remote end...");
			this.remote_socket.destroy();
			this.closed();
		}

	};

	this.open = function(){

		self.log("Tunnelling local port " + local_port + " to " + remote_host + " at " + remote_port);

		var keys = {
			key: fs.readFileSync(private_key_file).toString(),
			cert: fs.readFileSync(certificate_file).toString()
		};

		var remote_socket = new net.Socket();
		var local_socket = new net.Socket();

		// create and encrypted connection using ssl
		remote_socket = tls.connect(remote_port, remote_host, keys, function(){

			self.log("Connection established.");

			if (remote_socket.authorized)
				self.log("Credentials were valid!")
			else
				self.log("Credentials were NOT valid: " + remote_socket.authorizationError);

			self.opened();

		});

		local_socket.on('connect', function(){
			// self.log("local connected");
		})

		remote_socket.on("data", function(data) {

			self.log("Remote sent: " + data.length + " bytes.");
			// self.log(" -- Local socket state: " + local_socket.readyState);

			if(data == "stop"){

				self.log("Got STOP signal from server. Closing local socket.");
				local_socket.end();

			} else if(local_socket.readyState == "closed"){

				self.log("Opening local connection to " + local_port);
				local_socket.connect(local_port);

			} else {

				local_socket.write(data);

			}

		});

		local_socket.on("error", function(e) {
			self.log("Local socket error: " + e.code);
			// local_socket.end();
			remote_socket.end(e.code); // sends and ends
		});

		// if this happens then the connection was never made
		remote_socket.on("error", function(e) {
			self.log("Remote socket error: " + e.code);
			remote_socket.destroy();
		});

		local_socket.on("data", function(data) {
			self.log("Local sent " + data.length + " bytes.");
			if(remote_socket.readyState == 'open')
				remote_socket.write(data);
		});

		remote_socket.on("end", function() {
			self.log("Remote socket ended.");
			// self.connectionEnded(remote_socket);
			// local_socket.end();
		});

		local_socket.on("end", function() {
			self.log("Local socket ended.");
			// self.connectionEnded(local_socket);
			// remote_socket.end();
		});

		remote_socket.on("close", function(had_error) {
			self.log("Remote socket closed.");
			local_socket.end();
			self.closed();
			// self.connectionClosed(remote_socket, had_error);
		});

		local_socket.on("close", function(had_error) {
			self.log("Local socket closed.");
			// self.connectionClosed(local_socket, had_error);
		});

		this.remote_socket = remote_socket;
		this.local_socket = local_socket;

		return this;

	}

	return this.open();

};

util.inherits(Tunnel, emitter);
module.exports = Tunnel;
