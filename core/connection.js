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
		var stream = net.createConnection(parseInt(this.check_port), this.check_host);

		stream.on('connect', function() {
			self.established = true;
			self.emit('found');
			stream.end();
		});

		// listen for any errors
		stream.on('error', function(error) {
			console.log(' !! Error: ' + error.message);
			stream.end();
			self.emit('not_found');
		})

	}

	this.connect();

}

util.inherits(Connection, emitter);
module.exports = Connection;
