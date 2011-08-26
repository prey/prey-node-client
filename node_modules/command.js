//////////////////////////////////////////
// NodeJS Async Command Runner
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'), events = require('events'), exec = require('child_process').exec;

var Command = function(str){

	var self = this;
	var run = function(){

		var env = {
			PATH: "/bin;/sbin;/usr/bin;/usr/sbin;/usr/local/sbin;"
		}

		exec(str, env, function(error, stdout, stderr){
			if(error) self.emit('error', error);
			else self.emit('return', stdout);
		});

	}

	run();

};

sys.inherits(Command, events.EventEmitter);

exports.run = function(cmd){
	return new Command(cmd);
}
