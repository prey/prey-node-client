//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var net = require('net'), sys = require('sys'), events = require('events');

var check_port = 80;
var check_host = 'www.google.com';

var Connection = function(host, port){

	var self = this;
	var established = false;

	var connect = function(){

		// create TCP stream to server
		var stream = net.createConnection(parseInt(port), host);

		stream.on('connect', function() {
			this.established = true;
			self.emit('found');
			stream.end();
		});

		// listen for any errors
		stream.on('error', function(error) {
			console.log(' !! Error: ' + error.message);
			stream.destroy(); // close the stream
			self.emit('not_found');
		})

	}

	connect();

}

sys.inherits(Connection, events.EventEmitter);

exports.check = function(){
	return new Connection(check_host, check_port);
}
