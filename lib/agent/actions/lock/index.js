// @ts-check

/// ///////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
/// ///////////////////////////////////////

const path = require('path');

const { join } = path;
const Emitter = require('events').EventEmitter;
const { exec } = require('child_process');
const os = require('os');
const common = require('../../common');
const helpers = require('../../helpers');

const logger = common.logger.prefix('actions');
const { system } = common;
const run_as_user = system.run_as_logged_user;
const fetchEnvVar = require('../../../utils/fetch-env-var');
const ipc_server = require('./mac/ipc-server');

const os_name = os.platform().replace('darwin', 'mac').replace('win32', 'windows');
const is_win = os_name == 'windows';
const is_mac = os_name == 'mac';
const is_linux = os_name == 'linux';
const node_bin = join(system.paths.current, 'bin', 'node');
const release = parseFloat(os.release());

// Field rollback to the legacy prey-actions.app, flippable through the .env
// next to the versions dir without a redeploy.
const use_legacy_app = is_mac && fetchEnvVar('PREY_LOCK_LEGACY_APP') === 'true';

const lock_binary = lock_binary_path();
const default_pass = 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", because it does. :)

const IPC_STOP_TIMEOUT = 3000;

let child;
let timer;
let emitter;
let stopped;
let ipc;
let ipc_stop_timer;
let session_poll_timer;
let primary_user;
let pendingTbRestore;
let restoreCleanupTimer;

/** @returns {string} absolute path to the lock binary for this platform */
function lock_binary_path() {
  let binary_name = 'prey-lock';

  if (is_win) {
    // 6.1 as a number, not '6.1': release is a parseFloat, so the relational
    // operator already coerced the string operand. Same result, minus TS2365.
    binary_name = (release >= 6.1) ? 'new-prey-lock' : 'prey-lock';
  } else if (is_linux) {
    binary_name += helpers.gtkSuffix(common.os_release);
  } else if (is_mac) {
    // No os_release gate here: Prey.app covers every macOS version we support,
    // and os_release is only as reliable as sw_vers — when that call fails,
    // lib/system leaves the value undefined for good and nothing retries, so a
    // gate on it would resolve to a path that does not exist.
    return use_legacy_app
      ? (join(__dirname, '..', '..', 'utils', 'prey-actions.app', 'Contents', 'MacOS', 'prey-actions'))
      : (join(__dirname, '..', '..', 'utils', 'Prey.app', 'Contents', 'MacOS', 'Prey'));
  }

  return (join(__dirname, os_name, binary_name));
}

/**
 * Prey.app reports failed attempts and accepts unlock commands over a unix
 * socket only — it prints nothing to stdout. The legacy app is the other way
 * around, so the two paths are mutually exclusive.
 *
 * @returns {boolean}
 */
function use_ipc() {
  return is_mac && !use_legacy_app;
}

/** @returns {void} */
function teardown_ipc() {
  if (!ipc) return;
  ipc.removeAllListeners();
  try { ipc.close(); } catch (e) { /* best effort */ }
  ipc = null;
}

/**
 * @param {{event: string}} msg one decoded line from Prey.app
 * @returns {void}
 */
function handle_ipc_event(msg) {
  if (msg.event == 'failed_unlock_attempt') {
    if (emitter) emitter.emit('failed_unlock_attempt');
  } else if (msg.event == 'unlock_success') {
    // Informational: Lock.swift exits 66 right after sending this, and the
    // exit code is what drives finished(). Reacting to both would double-fire.
    logger.info('Lock unlocked by user');
  }
}

const md5_digest = function (str) {
  return require('crypto').createHash('md5').update(str).digest('hex');
};

function before() {
  if (is_mac) return;
  if (is_linux) {
    system.get_env((err, env) => {
      if (!err && env) {
        process.env.DISPLAY = env.display;
        process.env.XAUTHORITY = env.xauthority;
      }
    });
  } else {
    // as priviledged user, lock all escape mechanisms
    // we cannot do this as logged user because we lose privileges.
    exec(`${lock_binary} --block`);
  }
}

function after(cb) {
  if (!is_win) return cb();

  // ok, good. now restore access to escape routes.
  exec(`${lock_binary} --unblock`, () => {
    if (is_win) run_as_user(join(__dirname, os_name, 'tb-enable'), [], cb);
    else return cb();
  });
}

function start(id, opts, cb) {
  var opts = opts || {};
  let password = opts.password || opts.unlock_pass || default_pass;
  const message = opts.lock_message || '';

  if (!password || password.toString().trim() === '') return cb(new Error('No unlock password given!'));

  if (os_name == 'windows' && path.basename(lock_binary) == 'prey-lock') // old prey-lock binary for windows
  { password = password; } else password = Buffer.from(typeof password !== 'number' ? password : password.toString()).toString('base64');
  password = md5_digest(password.toString().trim());

  stopped = false; // ensure the flag is off

  open(id, password, message, cb);
}

/**
 * Brings the IPC listener up (when applicable) and then spawns the lock.
 *
 * @param {string} id action id
 * @param {string} password md5 of the base64'd unlock password
 * @param {string} message message shown on the lock screen
 * @param {(err: Error|null, emitter?: import('events').EventEmitter) => void} [cb] omitted on relaunch
 * @returns {void}
 */
function open(id, password, message, cb) {
  if (!message) message = '';

  timer = null;
  teardown_ipc(); // safety net for the relaunch path

  if (!use_ipc()) return spawn_lock(id, password, message, null, cb);

  // Prey.app's LockIPC connects once and never retries, so the server has to
  // be listening before we spawn it.
  ipc_server.createServer((err, handle) => {
    if (err) {
      // Degraded but usable: the lock still shows and the right password still
      // exits 66. We only lose failed_unlock_attempt and the clean remote stop.
      logger.info(`Lock IPC unavailable, continuing without it: ${err.message}`);
      return spawn_lock(id, password, message, null, cb);
    }

    ipc = handle;
    handle.on('event', handle_ipc_event);
    spawn_lock(id, password, message, handle.path, cb);
  });
}

/**
 * @param {string} id action id
 * @param {string} password md5 of the base64'd unlock password
 * @param {string} message message shown on the lock screen
 * @param {string|null} sock_path IPC socket to hand the app, null to skip it
 * @param {(err: Error|null, emitter?: import('events').EventEmitter) => void} [cb]
 * @returns {void}
 */
function spawn_lock(id, password, message, sock_path, cb) {
  let args;

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

  system.spawn_as_logged_user(lock_binary, args, (err, lock) => {
    if (err || stopped) {
      // if no logged user is found, retry in a sec or two.
      if (err && err.code == 'NO_LOGGED_USER') {
        // Drop the socket now, otherwise we leak one dir every 5s for as long
        // as the machine sits at the login window.
        teardown_ipc();
        timer = setTimeout(() => { open(id, password, message, cb); }, 5000);
        return;
      }
      teardown_ipc();
      return finished(id, () => { if (typeof cb === 'function') cb(err); });
    }

    before();

    child = lock;
    primary_user = lock.impersonating || null;

    child.stdout.on('data', (data) => {
      // Prey.app reports over IPC and prints nothing during a lock; these
      // patterns only come from the legacy mac app and the linux binaries.
      if (use_ipc()) return;

      if (child && child.impersonating && data.toString().match(/PID:? (\d+)/)) {
        child.impersonated_pid = data.toString().match(/PID:? (\d+)/)[1];
      } else if (emitter && data.toString().match(/invalid password/i)) {
        emitter.emit('failed_unlock_attempt');
      } else if (emitter && data.toString().match(/Window lost focus/i)) {
        logger.info('Lock window lost focus... restarting');
        child.kill();
      }
    });

    // LockIPC logs its connection state here, and it's the only diagnostic we
    // get when the socket handshake fails.
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        logger.debug(`lock: ${data.toString().trim()}`);
      });
    }

    child.once('exit', (code, signal) => {
      child = null;

      if (ipc_stop_timer) {
        clearTimeout(ipc_stop_timer);
        ipc_stop_timer = null;
      }
      teardown_ipc();

      if (stopped || code === 66 || code === 67 || code === 127) return finished(id);

      // trying to kill me are you? ha-ha-ha.
      after(() => {
        open(id, password, message);
      });
    });

    if (!emitter) {
      emitter = new Emitter();
      if (is_win) poll_sessions();
      if (typeof cb === 'function') cb(null, emitter);
    }
  });
}

/** @returns {void} */
function stop() {
  stopped = true;

  if (timer) clearTimeout(timer);

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
    setTouchPadState('Enable');
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

/** @returns {void} */
function hard_kill() {
  ipc_stop_timer = null;
  if (!child) return;

  if (child.impersonated_pid) system.kill_as_logged_user(child.impersonated_pid);
  else child.kill();
}

const setTouchPadState = (state) => {
  const data = {
    action: 'set-enabled-touchPad',
    key: 'device-key',
    token: 'token',
    logged: false,
    dirs: [state],
    optsKeep: [],
  };

  const action = 'set-enabled-touchPad';

  system.spawn_as_admin_user(node_bin, data, (err, touchpad) => {
    if (err) return logger.info(`Error Enabling Touchpad:${JSON.stringify(err)}`);
    if (typeof touchpad === 'function') touchpad(action, data);
  });
};

/**
 * @param {string} id action id
 * @param {() => void} [cb]
 * @returns {void}
 */
function finished(id, cb) {
  after(() => {
    if (is_win) setTouchPadState('Enable');

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
    if (typeof cb === 'function') cb();
  });
}

function poll_sessions() {
  if (!is_win) return;

  session_poll_timer = setInterval(() => {
    if (stopped) {
      clearInterval(session_poll_timer);
      session_poll_timer = null;
      return;
    }

    // bypassCache=true: this 5s poll must detect fast user-switches immediately,
    // so it always resolves a fresh logged user (never the short-lived TTL cache).
    system.get_logged_user((err, activeUser) => {
      if (err || stopped || !activeUser) return;

      if (pendingTbRestore && activeUser.toLowerCase() === pendingTbRestore.toLowerCase()) {
        run_as_user(join(__dirname, os_name, 'tb-enable'), [], () => {});
        pendingTbRestore = null;
      }

      if (primary_user && activeUser.toLowerCase() !== primary_user.toLowerCase()) {
        logger.info(`Active user changed to ${activeUser} — restarting lock`);
        pendingTbRestore = primary_user;
        primary_user = activeUser;
        if (child) child.kill();
      }
    }, true);
  }, 5000);
}

function is_running() {
  try { process.kill(child.pid, 0); return true; } catch (e) { return false; }
}

exports.events = ['failed_unlock_attempt'];

exports.start = function (id, options, cb) {
  if (child && is_running()) return cb(new Error('Lock already running!'));
  if (is_win) setTouchPadState('Disable');
  // Sockets left behind by an agent that was SIGKILLed mid-lock.
  if (use_ipc()) ipc_server.sweep();
  start(id, options, cb);
};

exports.stop = function () {
  if (!child && !ipc && !session_poll_timer && !restoreCleanupTimer) {
    if (timer) { clearTimeout(timer); timer = null; }
    return;
  }
  stop();
};
