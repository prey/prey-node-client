//////////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		util = require('util'),
		Emitter = require('events').EventEmitter,
		path = require('path'),
		spawn = require('child_process').spawn;

var lock_binary = __dirname + "/platform/" + common.os_name + "/prey-lock";

var Lock = function(){
	
	var self = this;
	
	this.start = function(options){
				
		var password = options.password || options.unlock_pass || 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", by default
		if(password.length != 32) password = this.digest_password(password);

		this.child = spawn(lock_binary, [password]);
		
		this.child.stdout.on('data', function(data){
			if(data.toString().match(/invalid password/i))
				self.emit('failed_attempt');
		})
		
		this.child.once('exit', function(code, signal){

			// console.log("Lock exited with code " + code);
			if(code == 66)
				self.emit('end', true);
			else 
				this.start(options);

		})
		
	};
	
	this.digest_password = function(str){
		return require('crypto').createHash('md5').update(str).digest('hex');
	}
	
	this.stop = function(){
		this.child.kill();
	}
	
	this.is_running = function(){
		try{ process.kill(this.child.pid, 0); return true }
		catch(e) { return false }
	}
	
}

util.inherits(Lock, Emitter);
exports.events = ['failed_attempt'];

exports.start = function(options, callback){
	var lock = exports.instance = new Lock();
	lock.start(options || {});
	setTimeout(function(){
		return lock.is_running() ? callback(lock) : callback(false);
	}, 100);
}

exports.stop = function(){
	exports.instance.stop();
}