"use strict";

//////////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util    = require('util'),
    join    = require('path').join,
    Emitter = require('events').EventEmitter,
    exec    = require('child_process').exec,
    system  = require('./../../common').system,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    is_win  = process.platform == 'win32';

var lock_binary  = join(__dirname, os_name, 'prey-lock'),
    default_pass = 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", because it does. :)

var child,
    timer,
    emitter,
    stopped;

var md5_digest = function(str){
  return require('crypto').createHash('md5').update(str).digest('hex');
};

function before(cb) {
  if (!is_win) return cb();

  // as priviledged user, lock all escape mechanisms
  // we cannot do this as logged user because we lose privileges.
  exec(lock_binary + ' --block', cb);
}

function after(cb) {
  if (!is_win) return cb();

  // ok, good. now restore access to escape routes.
  exec(lock_binary + ' --unblock', cb);
}

function start(opts, cb) {
  var opts     = opts || {},
      password = opts.password || opts.unlock_pass || default_pass;

  if (!password || password.toString().trim() === '')
    return cb(new Error('No unlock password given!'))

  if (password.toString().trim().length !== 32)
    password = md5_digest(password.toString().trim());

  stopped = false; // ensure the flag is off
  before(function() {
    open(password, cb)
  })
}

function open(password, cb) {

  timer = null;
  system.spawn_as_logged_user(lock_binary, [password], function(err, lock) {
    if (err || stopped) {

      // if no logged user is found, retry in a sec or two.
      if (err && err.code == 'NO_LOGGED_USER') {
        timer = setTimeout(function() { open(password, cb) }, 5000);
        return;
      } else {
        return finished(function() { cb && cb(err) });
      }

    }

    child = lock;

    child.stdout.on('data', function(data) {
      if (emitter && data.toString().match(/invalid password/i))
        emitter.emit('failed_unlock_attempt');
    });

    child.once('exit', function(code, signal) {
      child = null;

      // console.log("Lock exited with code " + code);
      if (stopped || code === 66 || code === 67)
        return finished();

      // trying to kill me are you? ha-ha-ha.
      // emitter.emit('lock_murder_attempt');
      open(password);
    });

    if (!emitter) {
      emitter = new Emitter;
      cb && cb(null, emitter);
    }
  });
}

function stop() {
  if (timer)
    clearTimeout(timer);

  if (child) {
    stopped = true;
    child.kill();
  }
}

function finished(cb) {
  after(function() {
    if (emitter) {
      emitter.emit('end');
      emitter = null;
    }
    cb && cb();
  })
}

function is_running() {
  try { process.kill(child.pid, 0); return true; }
  catch(e) { return false; }
}

exports.events = ['failed_unlock_attempt'];

exports.start = function(options, cb){
  if (child && is_running())
    return callback(new Error('Lock already running!'));

  start(options, cb);
};

exports.stop = function(){
  if (!child || !is_running())
    return;

  stop();
};
