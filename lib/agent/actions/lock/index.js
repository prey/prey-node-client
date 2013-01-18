"use strict";

//////////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util    = require('util'),
    Emitter = require('events').EventEmitter,
    system  = require('./../../common').system,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var lock_binary = __dirname + '/' + os_name + '/prey-lock',
    default_pass = 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", because it does. :)

var md5_digest = function(str){
  return require('crypto').createHash('md5').update(str).digest('hex');
};

var Lock = function(options){

  var self = this;
  options = options || {};

  this.stopped = false;
  this.password = options.password || options.unlock_pass || default_pass;

  if (this.password.length !== 32)
    this.password = md5_digest(this.password);

  this.start = function(cb){

    var self = this;

    system.spawn_as_logged_user(lock_binary, [this.password], function(err, child){
      if (err) return cb && cb(err);

      self.child = child;

      child.stdout.on('data', function(data){
        if (data.toString().match(/invalid password/i))
          self.emit('failed_unlock_attempt');
      });

      child.once('exit', function(code, signal){
        // console.log("Lock exited with code " + code);
        if (self.stopped || code === 66 || code === 67)
          self.emit('end');
        else
          self.start();
      });

      cb && cb(null, self);
    });

  };

  this.stop = function(){
    if (this.child) {
      this.stopped = true;
      this.child.kill();
    }
  };

  this.is_running = function(){
    try { process.kill(this.child.pid, 0); return true; }
    catch(e) { return false; }
  };

};

util.inherits(Lock, Emitter);
exports.events = ['failed_unlock_attempt'];

exports.start = function(options, callback){
  if (this.lock && this.lock.is_running())
    return callback(new Error('Lock already running!'));

  this.lock = new Lock(options);
  this.lock.start(callback);
};

exports.stop = function(){
  if (this.lock)
    this.lock.stop();

  this.lock = null;
};
