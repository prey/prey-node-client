//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		net = require('net'),
		util = require('util'),
		emitter = require('events').EventEmitter;

var Connection = function(proxy_config){

	var self = this;
	this.established = false;
	this.timeout = 5 * 1000; // 5 seconds

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
		socket.setTimeout(this.timeout);

		socket.connect(parseInt(this.check_port), this.check_host);

		socket.once('connect', function() {
			self.established = true;
			self.emit('found');
			socket.end();
		});

		socket.once('timeout', function(e) {
			logger.error('Connection timeout!');
			socket.destroy();
			self.emit('not_found');
		});

		// listen for any errors
		socket.once('error', function(error) {
			logger.error('Error: ' + error.message);
			socket.destroy();
			self.emit('not_found');
		})

	}

	this.connect();

}

util.inherits(Connection, emitter);
module.exports = Connection;
