//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		net = require('net'),
		util = require('util'),
		Emitter = require('events').EventEmitter;

var Connection = function(options){

	var self = this;
	// this.established = false;
	this.timeout = 5 * 1000; // 5 seconds

	this.target_host = options.host || 'www.google.com';
	this.target_port = options.port || 80;

	this.done = function(status, err){
		if(err) logger.error(err);
		this.emit(status, err);
		this.removeAllListeners();
		this.socket.destroy();
	};

	this.establish = function(){

		// create TCP stream to server
		var socket = this.socket = new net.Socket();
		socket.setTimeout(this.timeout);

		socket.connect(parseInt(this.target_port), this.target_host);

		socket.once('connect', function(){
			// self.established = true;
			self.done('connect');
		});

		socket.once('timeout', function(e){
			self.done('error', new Error("Connection timeout"));
		});

		// listen for any errors
		socket.once('error', function(e){
			self.done('error', e);
		})

	};

}

util.inherits(Connection, Emitter);

exports.check = function(options, callback){

	var connection = new Connection(options || {});

	connection.once('connect', callback);
	connection.once('error', function(err){

		if(options.proxy){ // second time will not contain this, so it wont loop
			var remote = url.parse(options.proxy);
			exports.check({host: remote.host, port: remote.port}, callback);
		} else {
			callback(err);
		}

	});

	connection.establish();
}
