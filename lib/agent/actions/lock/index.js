"use strict";

//////////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util        = require('util'),
    path        = require('path'),
    join        = path.join,
    Emitter     = require('events').EventEmitter,
    exec        = require('child_process').exec,
    common      = require('./../../common'),
    logger      = common.logger.prefix('actions'),
    system      = common.system,
    run_as_user = system.run_as_logged_user,
    os          = require('os'),
    os_name     = os.platform().replace('darwin', 'mac').replace('win32', 'windows'),
    os_path     = join(__dirname, os_name), // used for cwd when spawning child
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
    stopped,
    kill_apps;

function kill_running_apps(cb) {
  if (os_name != 'mac') return cb();
  var cmd = `ps aux |awk '{for(i=11;i<=NF;i++){printf "%s ", $i}; print $2}' | grep "^/Applications" | awk '{print $NF}'`

  exec(cmd, (err, out) => {
    var apps = out.split('\n').slice(0,-1);
    apps = apps.join(" ")

    var kill_cmd = 'kill -9 ' + apps + ';killall Finder';
    run_as_user(kill_cmd, [], (err) =>{
      return cb();
    })
  })
}

function lock_binary_path() {
  var binary_name = 'prey-lock';

  if (is_win) {
    binary_name = (release >= '6.1') ? 'new-prey-lock' : 'prey-lock';
  } else if (is_linux && system.python_version && system.python_version >= "3.0.0") {
    binary_name += "3";
  } else if (is_mac && common.os_release >= '11.0') {
    // New lock script for macOS Big Sur 
    return (join(__dirname, '..', '..', 'utils', 'prey-actions.app', 'Contents', 'MacOS', 'prey-actions'));
  }

  return (join(__dirname, os_name, binary_name));
}

var md5_digest = function(str){
  return require('crypto').createHash('md5').update(str).digest('hex');
};

function before(cb) {
  // as priviledged user, lock all escape mechanisms
  // we cannot do this as logged user because we lose privileges.
  if (is_win) return exec(lock_binary + ' --block', cb);
 
  if (is_linux || (is_mac && !kill_apps)) return cb();

  kill_running_apps(cb);
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

  kill_apps = false;
  kill_apps = opts.close_apps;

  if (!password || password.toString().trim() === '')
    return cb(new Error('No unlock password given!'))

  if (os_name == 'windows' && path.basename(lock_binary) == 'prey-lock') // old prey-lock binary for windows
    password = password;
  else
    password = Buffer.from(typeof password !== 'number' ? password : password.toString()).toString('base64');
  password = md5_digest(password.toString().trim());

  stopped = false; // ensure the flag is off
  before(function() {
    open(id, password, message, cb)
  })
}

function open(id, password, message, cb) {
  if (!message) message = "";

  var args = [password, message];
  if (is_mac && common.os_release >= '11.0')
    args.unshift('-lock')

  timer = null;
 
  system.spawn_as_logged_user(lock_binary, args, { cwd: os_path }, function(err, lock) {
    if (err || stopped) {

      // if no logged user is found, retry in a sec or two.
      if (err && err.code == 'NO_LOGGED_USER') {
        timer = setTimeout(function() { open(id, password, message, cb) }, 5000);
        return;
      } else {
        return finished(id, function() { cb && cb(err) });
      }
    }

    child = lock;

    child.stdout.on('data', function(data) {
      if (child && child.impersonating && data.toString().match(/PID:? (\d+)/)) {
        child.impersonated_pid = data.toString().match(/PID:? (\d+)/)[1];

      } else if (emitter && data.toString().match(/invalid password/i)) {
        emitter.emit('failed_unlock_attempt');
      }
    });

    child.once('exit', function(code, signal) {
      child = null;

      
      if (stopped || code === 66 || code === 67)
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