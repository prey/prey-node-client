//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var net = require('net'),
		sys = require('sys'),
		emitter = require('events').EventEmitter;

var Connection = function(){

	var self = this;
	this.established = false;

	if(config.use_proxy){
		this.check_port = config.proxy_port;
		this.check_host = config.proxy_host;
	} else {
		this.check_port = 80;
		this.check_host = 'www.google.com';
	}

	this.connect = function(){

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

sys.inherits(Connection, emitter);
module.exports = Connection;
