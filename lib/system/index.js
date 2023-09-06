const fs = require('fs'); // for fs.existsSync
const os = require('os');
const { join } = require('path');
const cp = require('child_process');
const async = require('async');
const remember = require('memorize');

const os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
const system = require(join(__dirname, os_name));
const { version } = require(join('..', '..', 'package'));

/// ///////////////////////////////////////////////////
// helpers

const clean_string = function (str) {
  return str.replace(/[^A-Za-z0-9\s]/g, '_').trim();
};

const capitalize = function (str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/// ///////////////////////////////////////////////////
// exports, base functions

module.exports = system;
system.os_name = os_name;
system.get_os_version((err, os_version) => {
  if (!err) {
    system.os_release = os_version;
    system.user_agent = `Prey/${version} (Node ${process.version} ${system.os_name[0].toUpperCase()}${system.os_name.slice(1)} ${os_version})`;
  }
});

system.paths = require('./paths');

// bin/scripts for as_logged_user
const node_bin = join(system.paths.package, 'bin', 'node');
const safexec_bin = join(__dirname, 'windows', 'bin', 'safexec.exe');
const runner_script = join(__dirname, 'utils', 'runner.js');

system.get_device_name = function (cb) {
  return os.hostname().replace(/\.local$/, ''); // remove trailing '.local'
};

system.tempfile_path = function (filename) {
  return join(system.paths.temp, filename);
};

system.get_os_info = remember((cb) => {
  let done;
  const data = {};

  data.arch = process.arch == 'x64' ? 'x64' : 'x86';

  async.parallel([
    system.get_os_name,
    system.get_os_version,
  ], (err, results) => {
    if (done) return;

    data.name = results[0] ? capitalize(results[0]) : osName;
    if (results[1]) data.version = results[1];

    cb(err, data);
    done = true;
  });
});

system.get_lang((lang) => {
  system.lang = lang;
});

system.python_version = null;
system.get_python_version((err, ver) => {
  if (!err && ver) system.python_version = ver;
});

system.get_current_hostname = system.get_current_hostname;

if (system.os_name == 'windows') {
  system.get_os_edition = system.get_os_edition;
  system.get_winsvc_version = system.get_winsvc_version;
  system.get_as_admin = system.get_as_admin;
  system.run_as_admin = system.run_as_admin;
  system.check_service = system.check_service;
}

/// ///////////////////////////////////////////////////
// logger user, running user

system.get_logged_user = remember((cb) => {
  system.find_logged_user((e, user) => {
    if (e || !user || user.trim() == '') {
      const err = new Error('No logged user detected.');
      if (e) err.message += ` ${e.message}`;
      err.code = 'NO_LOGGED_USER';
      return cb(err);
    }
    cb(null, user);
  });
});

system.get_admin_user = remember((cb) => {
  system.find_admin_user((e, user) => {
    if (e || !user || user.trim() == '') {
      const err = new Error('No admin user detected.');
      if (e) err.message += ` ${e.message}`;
      err.code = 'NO_ADMIN_USER';
      return cb(err);
    }
    cb(null, user);
  });
});

system.get_running_user = function () {
  const s = process.env.LOGNAME
          || process.env.USER
          || process.env.USERNAME || 'System';
  return clean_string(s);
};

const get_user = {
  logged_user: system.get_logged_user,
  admin_user: system.get_admin_user,
};

function get(type, cb) {
  get_user[type]((err, user) => cb(err, user));
}

/// ///////////////////////////////////////////////////
// impersonation

system.spawn_as_logged_user = function (command, args, opts, cb) {
  as('logged_user', 'spawn', command, args, opts, cb);
};

system.get_as_admin_user = function (what, cb) {
  system.check_service(what, (err, data) => {
    if (err) return cb(err);

    system.get_as_admin(data, cb);
  });
};

system.spawn_as_admin_user = function (command, args, opts, cb) {
  const options = {
    command, args, opts, cb,
  };

  if (system.os_name == 'windows') {
    system.check_service(options, (err, data) => { // An error means the new service isn't available
      if (err) {
        if (options.args && Array.isArray(options.args) && options.args[0].includes('wipe')) // For wipe only when service is not available
        { return as('logged_user', 'spawn', data.command, data.args, data.opts, data.cb); }

        var cb = data.opts;
        return cb();
      }

      var { cb } = data;
      if (typeof data.opts === 'function') cb = data.opts;
      return cb(null, system.run_as_admin);
    });
  } else as('admin_user', 'spawn', command, args, opts, cb);
};

system.run_as_logged_user = function (command, args, opts, cb) {
  as('logged_user', 'exec', command, args, opts, cb);
};

system.kill_as_logged_user = function (pid, cb) {
  var cb = cb || function () { /* boo-hoo */ };
  as('logged_user', 'exec', 'kill', [pid], {}, cb);
};

/**
 * run_as_user options have the same signature as as_user.
 */
system.run_as_user = as_user;

function as(user_type, type, bin, args, opts, cb) {
  if (typeof opts === 'function') {
    var cb = opts;
    var opts = {};
  } else if (!opts) {
    var opts = {};
  }

  get(user_type, (err, user) => {
    if (err) return cb(err);

    const options = {
      user,
      type,
      bin,
      args,
      opts,
    };
    as_user(options, cb);
  });
}

/**
 * as_user runs a command as the specified user.
 * An opts example is as follows:
 * {
 *  user: 'someuser'
 *  type: 'exec' | 'spawn'
 *  bin: '/usr/sbin/screencapture'
 *  args: '/tmp/dest.jpg'
 *  opts: {}
 * }
 */
function as_user(options, cb) {
  const { user } = options;
  const { bin } = options;
  const { type } = options;
  const { opts } = options;
  const { args } = options;
  let finished = false;
  let runner = options.bin;
  let command = options.args;

  if (!(user === system.get_running_user())) {
    if (osName == 'windows') {
      runner = safexec_bin;
      if (type == 'exec') runner = `"${runner}"`;
      command = [`"${bin}"`].concat(args.map((x) => `"${x}"`));
    } else {
      runner = runner_script;
      command = [user, bin].concat(args);

      if (fs.existsSync(node_bin)) {
        command = [runner].concat(command);
        runner = node_bin;
      }
    }
  }

  if (!opts.env) opts.env = process.env;

  if (process.platform == 'linux' && !opts.env.DISPLAY) {
    opts.env.DISPLAY = ':0'; // ensure active display is used
  }

  if (type == 'exec') {
    const cmd = `${runner} ${command ? command.join(' ') : ''}`;
    var child = cp.exec(cmd, opts, cb);
    child.impersonating = user;
    return child;
  }

  const done = function (e) {
    if (finished) return;

    finished = true;
    cb(e, child);
  };

  // ok, so they want spawn mode. let's fire up the command.
  var child = cp.spawn(runner, command, opts);
  child.impersonating = user;

  // set a listener on error, so if it fails the app doesn't crash!
  child.on('error', (err) => {
    if (err.code == 'ENOENT') { err.message = `ENOENT - Executable not found: ${runner}`; }

    done(err);
  });

  process.nextTick(done);
}
console.log('system');
console.log(system);
module.exports = system;
