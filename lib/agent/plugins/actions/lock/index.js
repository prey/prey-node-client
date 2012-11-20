"use strict";

//////////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = _ns('common'),
		util = require('util'),
		Emitter = require('events').EventEmitter,
		path = require('path'),
		spawn = require('child_process').spawn;

var lock_instance,
		lock_binary = __dirname + "/platform/" + common.os_name + "/prey-lock",
		default_pass = 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", because it does. :)

var md5_digest = function(str){
	return require('crypto').createHash('md5').update(str).digest('hex');
};

var Lock = function(options){

	var self = this;
	this.options = options;
	this.password = options.password || options.unlock_pass || default_pass;

	if (this.password.length !== 32)
	  this.password = md5_digest(this.password);

	this.start = function(){

		this.child = spawn(lock_binary, [this.password]);

		this.child.stdout.on('data', function(data){
			if (data.toString().match(/invalid password/i))
				self.emit('failed_unlock_attempt');
		});

		this.child.once('exit', function(code, signal){

			// console.log("Lock exited with code " + code);
			if (code === 66)
				self.emit('end');
			else
				self.start();

		});

	};

	this.stop = function(){
		if (this.child)
			this.child.kill();
	};

	this.is_running = function(){
		try { process.kill(this.child.pid, 0); return true; }
		catch(e) { return false; }
	};

};

util.inherits(Lock, Emitter);
exports.events = ['failed_unlock_attempt'];

exports.start = function(options, callback){
  if (lock_instance) return callback(_error('Lock already running!'));

	lock_instance = new Lock(options);
	lock_instance.start();

	setTimeout(function(){
		return lock_instance.is_running() ? callback() : callback(_error("Lock not running!"));
	}, 100);

	return lock_instance;
};

exports.stop = function(){
	if (lock_instance)
		lock_instance.stop();

	lock_instance = null;
};
