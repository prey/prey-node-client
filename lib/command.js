//////////////////////////////////////////
// NodeJS Async Command Runner
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		emitter = require('events').EventEmitter,
		exec = require('child_process').exec,
		spawn = require('child_process').spawn;

// var cmd = new Command('tail -f /var/log/access.log');
// cmd will emit either error or return, depending on result
// but will always emit an exit event

var Command = function(str){

	var self = this;
	this.spawned = false;

	this.run = function(cmd){

		if(cmd.indexOf('|') == -1){
			this.spawned = true;
			// console.log("Spawning " + cmd);
			this.spawn(cmd)
		} else {
			// console.log("Executing " + cmd);
			this.exec(cmd)
		}

	}

	this.spawn = function(cmd){

		var split_cmd = cmd.split(' ');
		this.child = spawn(split_cmd[0], split_cmd.slice(1));

		this.child.stdout.on('data', function (data) {
			self.stdout = data.toString();
		});

		this.child.stderr.on('data', function (data) {
			self.stderr = data.toString();
		});

		this.child.on('exit', function (code, signal) {
			// console.log("child returned with code " + code);

			if(code == 0) {
				self.emit('return', self.stdout);
			} else if(code == null){
				self.emit('error', {message: "Child process killed with " + signal + " signal.", code: code, signal: signal});
			} else {
				self.emit('error', {message: self.stderr, code: code, signal: signal});
			}

			self.emit('exit');

		});

	}

	this.exec = function(cmd){

		var env = {
//			PATH: "/bin;/sbin;/usr/bin;/usr/sbin;/usr/local/bin;/usr/local/sbin;"
			PATH: process.env['PATH']
		}

		this.child = exec(cmd, env, function(error, stdout, stderr){
			if(error) self.emit('error', error);
			else self.emit('return', stdout);
			self.emit('exit');
		});

	}

	this.is_running = function(){
		try {
			process.kill(this.child.pid, 0);
			return true;
		} catch(e) {
			return false;
		}
	};

	// sends SIGSTOP signal to process
	this.pause = function(){
		return this.kill('SIGSTOP');
	};

	this.resume = function(){
		return this.kill('SIGCONT');
	};

	this.kill = function(signal){
		return this.child.kill(signal || 'SIGTERM');
	};

	this.run(str);

};

sys.inherits(Command, emitter);
module.exports = Command;
