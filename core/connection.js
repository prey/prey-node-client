//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		net = require('net'),
		util = require('util'),
		emitter = require('events').EventEmitter;

var Connection = function(proxy_config){

	var self = this;
	this.established = false;

	if(proxy_config.enabled){
		this.check_port = proxy_config.port;
		this.check_host = proxy_config.host;
	} else {
		this.check_port = 80;
		this.check_host = 'www.google.com';
	}

	this.connect = function(config){

		// create TCP stream to server
		var socket = new net.Socket();
		socket.setTimeout(10 * 1000); // 10 seconds

		socket.connect(parseInt(this.check_port), this.check_host);

		socket.on('connect', function() {
			self.established = true;
			self.emit('found');
			socket.end();
		});

		socket.on('timeout', function(e) {
			console.log(' !! Timeout!');
			socket.end();
			self.emit('not_found');
		});

		// listen for any errors
		socket.on('error', function(error) {
			console.log(' !! Error: ' + error.message);
			socket.end();
			self.emit('not_found');
		})

	}

	this.connect();

}

util.inherits(Connection, emitter);
module.exports = Connection;
