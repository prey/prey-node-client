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
    fetchEnvVar = require('./../../../utils/fetch-env-var'),
    ipc_server  = require('./mac/ipc-server'),
    os          = require('os'),
    os_name     = os.platform().replace('darwin', 'mac').replace('win32', 'windows'),
    is_win      = os_name == 'windows',
    is_mac      = os_name == 'mac',
    is_linux    = os_name == 'linux',
    node_bin    = join(system.paths.current, 'bin', 'node'),
    release     = parseFloat(os.release());

// Field rollback to the legacy prey-actions.app, flippable through the .env
// next to the versions dir without a redeploy.
var use_legacy_app = is_mac && fetchEnvVar('PREY_LOCK_LEGACY_APP') === 'true';

var lock_binary  = lock_binary_path(),
    default_pass = 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", because it does. :)

var IPC_STOP_TIMEOUT = 3000;

var child,
    timer,
    emitter,
    stopped,
    ipc,
    ipc_stop_timer,
    session_poll_timer,
    primary_user,
    pendingTbRestore,
    restoreCleanupTimer;

function lock_binary_path() {
  var binary_name = 'prey-lock';

  if (is_win) {
    binary_name = (release >= '6.1') ? 'new-prey-lock' : 'prey-lock';
  } else if (is_linux) {
    binary_name += (common.os_release >= '24.04') ? '-gtk4' : '-gtk3'
  } else if (is_mac) {
    // No os_release gate here: Prey.app covers every macOS version we support,
    // and common.os_release is populated asynchronously — after this module is
    // loaded — so gating on it is a race.
    return use_legacy_app
      ? (join(__dirname, '..', '..', 'utils', 'prey-actions.app', 'Contents', 'MacOS', 'prey-actions'))
      : (join(__dirname, '..', '..', 'utils', 'Prey.app', 'Contents', 'MacOS', 'Prey'));
  }

  return (join(__dirname, os_name, binary_name));
}

// Prey.app reports failed attempts and accepts unlock commands over a unix
// socket only — it prints nothing to stdout. The legacy app is the other way
// around, so the two paths are mutually exclusive.
function use_ipc() {
  return is_mac && !use_legacy_app;
}

function teardown_ipc() {
  if (!ipc) return;
  ipc.removeAllListeners();
  try { ipc.close(); } catch (e) { /* best effort */ }
  ipc = null;
}

function handle_ipc_event(msg) {
  if (msg.event == 'failed_unlock_attempt') {
    if (emitter) emitter.emit('failed_unlock_attempt');
  } else if (msg.event == 'unlock_success') {
    // Informational: Lock.swift exits 66 right after sending this, and the
    // exit code is what drives finished(). Reacting to both would double-fire.
    logger.info('Lock unlocked by user');
  }
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

  timer = null;
  teardown_ipc(); // safety net for the relaunch path

  if (!use_ipc())
    return spawn_lock(id, password, message, null, cb);

  // Prey.app's LockIPC connects once and never retries, so the server has to
  // be listening before we spawn it.
  ipc_server.createServer(function(err, handle) {
    if (err) {
      // Degraded but usable: the lock still shows and the right password still
      // exits 66. We only lose failed_unlock_attempt and the clean remote stop.
      logger.info('Lock IPC unavailable, continuing without it: ' + err.message);
      return spawn_lock(id, password, message, null, cb);
    }

    ipc = handle;
    handle.on('event', handle_ipc_event);
    spawn_lock(id, password, message, handle.path, cb);
  });
}

function spawn_lock(id, password, message, sock_path, cb) {
  var args;

  if (is_mac) {
    args = ['-lock', password];
    // -socket goes before the message: handleLock takes the first argument
    // that is neither a known flag nor a flag's value as the message, so a
    // message that literally reads "-socket" would otherwise eat the path.
    if (sock_path) args = args.concat(['-socket', sock_path]);
    args.push(message);
  } else {
    args = [password, message];
  }

  system.spawn_as_logged_user(lock_binary, args, function(err, lock) {
    if (err || stopped) {

      // if no logged user is found, retry in a sec or two.
      if (err && err.code == 'NO_LOGGED_USER') {
        // Drop the socket now, otherwise we leak one dir every 5s for as long
        // as the machine sits at the login window.
        teardown_ipc();
        timer = setTimeout(function() { open(id, password, message, cb) }, 5000);
        return;
      } else {
        teardown_ipc();
        return finished(id, function() { cb && cb(err) });
      }
    }

    before()

    child = lock;
    primary_user = lock.impersonating || null;

    child.stdout.on('data', function(data) {
      // Prey.app reports over IPC and prints nothing during a lock; these
      // patterns only come from the legacy mac app and the linux binaries.
      if (use_ipc()) return;

      if (child && child.impersonating && data.toString().match(/PID:? (\d+)/)) {
        child.impersonated_pid = data.toString().match(/PID:? (\d+)/)[1];

      } else if (emitter && data.toString().match(/invalid password/i)) {
        emitter.emit('failed_unlock_attempt');

      } else if (emitter && data.toString().match(/Window lost focus/i)) {
        logger.info("Lock window lost focus... restarting");
        child.kill();
      }
    });

    // LockIPC logs its connection state here, and it's the only diagnostic we
    // get when the socket handshake fails.
    if (child.stderr) {
      child.stderr.on('data', function(data) {
        logger.debug('lock: ' + data.toString().trim());
      });
    }

    child.once('exit', function(code, signal) {
      child = null;

      if (ipc_stop_timer) {
        clearTimeout(ipc_stop_timer);
        ipc_stop_timer = null;
      }
      teardown_ipc();

      if (stopped || code === 66 || code === 67 || code === 127)
        return finished(id);

      // trying to kill me are you? ha-ha-ha.
      after(function reopen() {
        open(id, password, message);
      });
    });

    if (!emitter) {
      emitter = new Emitter;
      if (is_win) poll_sessions();
      cb && cb(null, emitter);
    }
  });
}

function stop() {
  stopped = true;

  if (timer)
    clearTimeout(timer);

  if (session_poll_timer) {
    clearInterval(session_poll_timer);
    session_poll_timer = null;
  }

  if (restoreCleanupTimer) clearInterval(restoreCleanupTimer);
  restoreCleanupTimer = null;
  pendingTbRestore = null;

  if (!child) {
    teardown_ipc();
    return;
  }

  // setTouchPadState is Windows-only: on any other platform it hands an object
  // where cp.spawn expects a string and throws synchronously.
  if (is_win) {
    setTouchPadState("Enable");
    child.kill();
    return;
  }

  if (ipc && ipc.connected) {
    // Let Prey.app tear its own screen down and exit 66, instead of racing a
    // signal against the display release.
    ipc.send({ cmd: 'unlock' });
    ipc_stop_timer = setTimeout(hard_kill, IPC_STOP_TIMEOUT);
    return;
  }

  hard_kill();
}

function hard_kill() {
  ipc_stop_timer = null;
  if (!child) return;

  if (child.impersonated_pid) system.kill_as_logged_user(child.impersonated_pid);
  else child.kill();
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

    teardown_ipc();
    primary_user = null;
    if (session_poll_timer) {
      clearInterval(session_poll_timer);
      session_poll_timer = null;
    }

    if (pendingTbRestore && !restoreCleanupTimer) {
      const userToRestore = pendingTbRestore;
      pendingTbRestore = null;
      restoreCleanupTimer = setInterval(() => {
        system.get_logged_user((err, activeUser) => {
          if (err || !activeUser) return;
          if (activeUser.toLowerCase() === userToRestore.toLowerCase()) {
            run_as_user(join(__dirname, os_name, 'tb-enable'), [], () => {});
            clearInterval(restoreCleanupTimer);
            restoreCleanupTimer = null;
          }
        });
      }, 5000);
    }

    if (emitter) {
      emitter.emit('end', id);
      emitter = null;
    }
    cb && cb();
  })
}

function poll_sessions() {
  if (!is_win) return;

  session_poll_timer = setInterval(function() {
    if (stopped) {
      clearInterval(session_poll_timer);
      session_poll_timer = null;
      return;
    }

    system.get_logged_user(function(err, activeUser) {
      if (err || stopped || !activeUser) return;

      if (pendingTbRestore && activeUser.toLowerCase() === pendingTbRestore.toLowerCase()) {
        run_as_user(join(__dirname, os_name, 'tb-enable'), [], () => {});
        pendingTbRestore = null;
      }

      if (primary_user && activeUser.toLowerCase() !== primary_user.toLowerCase()) {
        logger.info("Active user changed to " + activeUser + " — restarting lock");
        pendingTbRestore = primary_user;
        primary_user = activeUser;
        if (child) child.kill();
      }
    });
  }, 5000);
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
  // Sockets left behind by an agent that was SIGKILLed mid-lock.
  if (use_ipc()) ipc_server.sweep();
  start(id, options, cb);
};

exports.stop = function(){
  if (!child && !ipc && !session_poll_timer && !restoreCleanupTimer) {
    if (timer) { clearTimeout(timer); timer = null; }
    return;
  }
  stop();
};