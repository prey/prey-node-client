"use strict";

//////////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var path        = require('path'),
    join        = path.join,
    Emitter     = require('events').EventEmitter,
    exec        = require('child_process').exec,
    common      = require('./../../common'),
    logger      = common.logger.prefix('actions'),
    system      = common.system,
    run_as_user = system.run_as_logged_user,
    os          = require('os'),
    os_name     = os.platform().replace('darwin', 'mac').replace('win32', 'windows'),
    is_win      = os_name == 'windows',
    is_mac      = os_name == 'mac',
    is_linux    = os_name == 'linux',
    node_bin    = join(system.paths.current, 'bin', 'node'),
    release     = parseFloat(os.release());

var lock_binary  = lock_binary_path(),
    default_pass = 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", because it does. :)

var child,
    timer,
    emitter,
    stopped;

function lock_binary_path() {
  var binary_name = 'prey-lock';

  if (is_win) {
    binary_name = (release >= '6.1') ? 'new-prey-lock' : 'prey-lock';
  } else if (is_linux) {
    binary_name += (common.os_release >= '24.04') ? '-gtk4' : '-gtk3'
  } else if (is_mac && common.os_release >= '11.0') {
    // New lock script for macOS Big Sur 
    return (join(__dirname, '..', '..', 'utils', 'prey-actions.app', 'Contents', 'MacOS', 'prey-actions'));
  }

  return (join(__dirname, os_name, binary_name));
}

var md5_digest = function(str){
  return require('crypto').createHash('md5').update(str).digest('hex');
};

function before() {
  if (is_mac) return;
  else if (is_linux) {
    system.get_env((err, env) => {
      if (!err && env) {
        process.env.DISPLAY = env.display;
        process.env.XAUTHORITY = env.xauthority;
      }
    });
  }
  else {
    // as priviledged user, lock all escape mechanisms
    // we cannot do this as logged user because we lose privileges.
    exec(lock_binary + ' --block');
  }
}

function after(cb) {
  if (!is_win) return cb();

  // ok, good. now restore access to escape routes.
  exec(lock_binary + ' --unblock', function() {
    if (is_win) run_as_user(join(__dirname, os_name, 'tb-enable'), [], cb);
    else return cb();
  });
}

function start(id, opts, cb) {
  var opts     = opts || {},
      password = opts.password || opts.unlock_pass || default_pass,
      message  = opts.lock_message || "";

  if (!password || password.toString().trim() === '')
    return cb(new Error('No unlock password given!'))

  if (os_name == 'windows' && path.basename(lock_binary) == 'prey-lock') // old prey-lock binary for windows
    password = password;
  else
    password = Buffer.from(typeof password !== 'number' ? password : password.toString()).toString('base64');
  password = md5_digest(password.toString().trim());

  stopped = false; // ensure the flag is off

  open(id, password, message, cb)
}

function open(id, password, message, cb) {
  if (!message) message = "";

  var args = [password, message];
  if (is_mac && common.os_release >= '11.0')
    args.unshift('-lock')

  timer = null;
 
  system.spawn_as_logged_user(lock_binary, args, function(err, lock) {
    if (err || stopped) {

      // if no logged user is found, retry in a sec or two.
      if (err && err.code == 'NO_LOGGED_USER') {
        timer = setTimeout(function() { open(id, password, message, cb) }, 5000);
        return;
      } else {
        return finished(id, function() { cb && cb(err) });
      }
    }

    before()

    child = lock;

    child.stdout.on('data', function(data) {
      if (child && child.impersonating && data.toString().match(/PID:? (\d+)/)) {
        child.impersonated_pid = data.toString().match(/PID:? (\d+)/)[1];

      } else if (emitter && data.toString().match(/invalid password/i)) {
        emitter.emit('failed_unlock_attempt');

      } else if (emitter && data.toString().match(/Window lost focus/i)) {
        logger.info("Lock window lost focus... restarting");
        child.kill();
      }
    });

    child.once('exit', function(code, signal) {
      child = null;

      if (stopped || code === 66 || code === 67 || code === 127)
        return finished(id);

      // trying to kill me are you? ha-ha-ha.
      
      open(id, password, message);
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

    if (is_win || !child.impersonated_pid) {
      setTouchPadState("Enable");
      child.kill();
    } else {
      system.kill_as_logged_user(child.impersonated_pid);
    }
  }
}

const setTouchPadState = (state) => {
  let data = {
    action: "set-enabled-touchPad",
    key: "device-key",
    token: "token",
    logged: false,
    dirs : [state],
    optsKeep: []
  }

  let action = 'set-enabled-touchPad';

  system.spawn_as_admin_user(node_bin, data, function(err, touchpad) {
    if(err) return logger.info('Error Enabling Touchpad:' + JSON.stringify(err));
    if (typeof touchpad == 'function') touchpad(action, data);
  });
}

function finished(id, cb) {
  after(function() {
    if(is_win)
     setTouchPadState("Enable");
    
    if (emitter) {
      emitter.emit('end', id);
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

exports.start = function(id, options, cb){
  if (child && is_running())
    return cb(new Error('Lock already running!'));
  if(is_win)
    setTouchPadState("Disable");
  start(id, options, cb);
};

exports.stop = function(){
  if (!child || !is_running())
    return;

  stop();
};