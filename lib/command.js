//////////////////////////////////////////
// NodeJS Async Command Runner
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		emitter = require('events').EventEmitter,

		exec = require('child_process').exec;

var Command = function(str){

	var self = this;
	this.run = function(comm){

		var env = {
			PATH: "/bin;/sbin;/usr/bin;/usr/sbin;/usr/local/bin;/usr/local/sbin;"
		}

		this.child = exec(comm, env, function(error, stdout, stderr){
			if(error) self.emit('error', error);
			else self.emit('return', stdout);
		});

	}

	this.kill = function(){
		process.kill(this.child.pid, arguments[0]);
	};

	this.run(str);

};

sys.inherits(Command, emitter);
module.exports = Command;
