//////////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../lib/prey/common'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		path = require('path'),
		spawn = require('child_process').spawn;

var lock_binary = __dirname + "/platform/" + common.os_name + "/prey-lock";

var Lock = function(){
	
	var self = this;
	
	this.start = function(options){
		
		this.child = spawn(lock_binary);
		
		this.child.once('exit', function(code, signal){

			console.log("Lock exited with code " + code);

			if(code == 66)
				self.emit('end', true);
			else 
				this.start(options);

		})
		
	};
	
	this.stop = function(){
		this.child.kill();
	}
	
	this.is_running = function(){
		try{ process.kill(this.child.pid, 0); return true }
		catch(e) { return false }
	}
	
}

util.inherits(Lock, emitter);

exports.start = function(options, callback){
	var lock = exports.instance = new Lock(options);
	lock.start();
	setTimeout(function(){
		return lock.is_running() ? callback(lock) : callback(false);
	}, 100);
}

exports.stop = function(){
	exports.instance.stop();
}