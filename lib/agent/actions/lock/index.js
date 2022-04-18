/* eslint-disable linebreak-style */
/// ///////////////////////////////////////
// Prey JS Lock Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
/// ///////////////////////////////////////

const path = require('path');

const { join } = path;
const Emitter = require('events').EventEmitter;
const crypto = require('crypto');
const { exec } = require('child_process');
const os = require('os');
const common = require('../../common');

const logger = common.logger.prefix('actions');
const { system } = common;
const runAsUser = system.run_as_logged_user;
const osName = os.platform().replace('darwin', 'mac').replace('win32', 'windows');
// eslint-disable-next-line no-undef
const osPath = join(__dirname, osName); // used for cwd when spawning child
const isWin = osName === 'windows';
const isMac = osName === 'mac';
const isLinux = osName === 'linux';
const nodeBin = join(system.paths.current, 'bin', 'node');
const release = parseFloat(os.release());

const defaultPass = 'e75f0173be748b6f68b3feb61255693c'; // "preyrocks", because it does. :)

let child;
let timer;
let emitter;
let stopped;
let killApps;

// eslint-disable-next-line consistent-return
const killRunningApps = (cb) => {
  if (osName !== 'mac') return cb();
  // eslint-disable-next-line quotes
  const cmd = `ps aux |awk '{for(i=11;i<=NF;i++){printf "%s ", $i}; print $2}' | grep "^/Applications" | awk '{print $NF}`;

  exec(cmd, (err, out) => {
    let apps = out.split('\n').slice(0, -1);
    apps = apps.join(' ');

    const killCmd = `kill -9  ${apps};killall Finder`;
    runAsUser(killCmd, [], () => cb());
  });
};

const lockBinaryPath = () => {
  let binaryName = 'prey-lock';

  if (isWin) {
    binaryName = (release >= '6.1') ? 'new-prey-lock' : 'prey-lock';
  } else if (isLinux && system.python_version && system.python_version >= '3.0.0') {
    // eslint-disable-next-line no-unused-vars
    binaryName += '3';
  } else if (isMac && common.os_release >= '11.0') {
    // New lock script for macOS Big Sur
    return (join(__dirname, '..', '..', 'utils', 'prey-actions.app', 'Contents', 'MacOS', 'prey-actions'));
  }
  return (join(__dirname, osName, binaryName));
};

const lockBinary = lockBinaryPath();

const md5Digest = (str) => crypto.createHash('md5').update(str).digest('hex');

// eslint-disable-next-line consistent-return
const before = (cb) => {
  // as priviledged user, lock all escape mechanisms
  // we cannot do this as logged user because we lose privileges.
  if (isWin) return exec(`${lockBinary} --block`, cb);
  if (isLinux || (isMac && !killApps)) return cb();
  killRunningApps(cb);
};

// eslint-disable-next-line consistent-return
const after = (cb) => {
  if (!isWin) return cb();

  // ok, good. now restore access to escape routes.
  // eslint-disable-next-line consistent-return
  exec(`${lockBinary} --unblock`, () => {
    // eslint-disable-next-line no-undef
    if (isWin) runAsUser(join(__dirname, osName, 'tb-enable'), [], cb);
    else return cb();
  });
};

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

  // eslint-disable-next-line consistent-return
  system.spawn_as_admin_user(nodeBin, data, (err, touchpad) => {
    if (err) return logger.info(`Error Enabling Touchpad: ${JSON.stringify(err)}`);
    if (typeof touchpad === 'function') touchpad(action, data);
  });
};

const finished = (id, cb) => {
  after(() => {
    if (isWin) setTouchPadState('Enable');

    if (emitter) {
      emitter.emit('end', id);
      emitter = null;
    }
    // eslint-disable-next-line no-unused-expressions
    cb && cb();
  });
};

const open = (id, password, message, cb) => {
  // eslint-disable-next-line no-param-reassign
  if (!message) message = '';

  // eslint-disable-next-line prefer-const
  let args = [password, message];
  if (isMac && common.os_release >= '11.0') args.unshift('-lock');

  timer = null;
  system.spawn_as_logged_user(lockBinary, args, { cwd: osPath }, (err, lock) => {
    if (err || stopped) {
      // if no logged user is found, retry in a sec or two.
      if (err && err.code === 'NO_LOGGED_USER') {
        timer = setTimeout(() => { open(id, password, message, cb); }, 5000);
        return;
      }
      // eslint-disable-next-line consistent-return
      return finished(id, () => cb && cb(err));
    }

    child = lock;

    child.stdout.on('data', (data) => {
      // eslint-disable-next-line prefer-destructuring
      if (child && child.impersonating && data.toString().match(/PID:? (\d+)/)) child.impersonated_pid = data.toString().match(/PID:? (\d+)/)[1];
      else if (emitter && data.toString().match(/invalid password/i)) emitter.emit('failed_unlock_attempt');
    });

    // eslint-disable-next-line consistent-return
    child.once('exit', (code) => {
      child = null;
      if (stopped || code === 66 || code === 67) return finished(id);
      // trying to kill me are you? ha-ha-ha.
      open(id, password, message);
    });

    if (!emitter) {
      emitter = new Emitter();
      // eslint-disable-next-line no-unused-expressions
      cb && cb(null, emitter);
    }
  });
};

// eslint-disable-next-line consistent-return
const start = (id, opts, cb) => {
  // eslint-disable-next-line no-param-reassign
  opts = opts || {};
  let password = opts.password || opts.unlock_pass || defaultPass;
  const message = opts.lock_message || '';

  killApps = false;
  killApps = opts.close_apps;

  if (!password || password.toString().trim() === '') return cb(new Error('No unlock password given!'));
  if (!(osName === 'windows' && path.basename(lockBinary) === 'prey-lock')) {
    // eslint-disable-next-line no-undef
    password = Buffer.from(typeof password !== 'number' ? password : password.toString()).toString('base64');
  }
  password = md5Digest(password.toString().trim());

  stopped = false; // ensure the flag is off
  before(() => open(id, password, message, cb));
};

const stop = () => {
  if (timer) clearTimeout(timer);

  if (child) {
    stopped = true;

    if (isWin || !child.impersonated_pid) {
      setTouchPadState('Enable');
      child.kill();
    } else {
      system.kill_as_logged_user(child.impersonated_pid);
    }
  }
};

const isRunning = () => {
  // eslint-disable-next-line no-undef
  try { process.kill(child.pid, 0); return true; } catch (e) { return false; }
};

exports.events = ['failed_unlock_attempt'];

// eslint-disable-next-line consistent-return
exports.start = (id, options, cb) => {
  if (child && isRunning()) {
    if (typeof options === 'function') return cb(new Error('Lock already running!'));
    // eslint-disable-next-line consistent-return
    return;
  }
  if (isWin) setTouchPadState('Disable');
  start(id, options, cb);
};

exports.stop = () => {
  if (!child || !isRunning()) return;
  stop();
};
