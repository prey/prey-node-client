//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		net = require('net'),
		util = require('util'),
		hooks = require('./hook_dispatcher');
		// emitter = require('events').EventEmitter;

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

	this.done = function(status){
		// self.emit(status);
		// this.removeAllListeners();
		hooks.trigger(status);
		this.socket.destroy();
	};

	this.establish = function(){

		// create TCP stream to server
		var socket = this.socket = new net.Socket();
		socket.setTimeout(this.timeout);

		socket.connect(parseInt(this.check_port), this.check_host);

		socket.once('connect', function() {
			self.established = true;
			self.done('connection_found');
		});

		socket.once('timeout', function(e) {
			logger.error('Connection timeout!');
			self.done('no_connection');
		});

		// listen for any errors
		socket.once('error', function(error) {
			logger.error('Error: ' + error.message);
			self.done('no_connection');
		})

	};

}

// util.inherits(Connection, emitter);
// module.exports = Connection;

exports.check = function(options){
	var connection = new Connection(options || {});
	connection.establish();
}