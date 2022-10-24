var fs         = require('fs'),
    satan      = require('satan'),
    join       = require('path').join,
    is_greater = require('compare-versions'),
    is_greater_or_equal = require('../../agent/helpers').is_greater_or_equal,
    system     = require('./../../system'),
    paths      = require('./../../system/paths'),
    exec       = require('child_process').exec,
    os_name    = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    common     = require('../../agent/common'),
    logger     = common.logger.prefix('DAEMON'),
    storage    = require('../../agent/utils/storage'),
    is_windows = process.platform == 'win32';

var bin_path   = join(paths.current, 'bin'),
    prey_user  = 'prey',
    root_user  = 'root',
    greater    = -1,
    vers_err   = null;

var run = function(cmd, cb) {
  exec(cmd, cb)
}

var watcher_opts = {
  key      : 'com.prey.owl',
  bin      : join(`${paths.install}`, 'prey-user'),
  user     : root_user,
  interval : 3600,      // check every hour
  name     : 'Prey Owl'
}

if (is_windows) {

  var exe_name         = 'wpxsvc.exe',
      old_exe_name     = 'wpxsvc_old.exe',
      service_bin      = join(paths.current, 'lib', 'system', 'windows', 'bin', exe_name),
      service_bin_old  = join(paths.current, 'lib', 'system', 'windows', 'bin', old_exe_name),
      service_run_path = join(paths.install, exe_name);

  var daemon_opts = {
    bin  : service_run_path,
    // path : paths.current,
    key  : 'CronService',
    name : 'Cron Service',
    desc : 'Streamlines the execution of commands based on a system schedule.',
    daemon_path : null
  }

} else {

  var daemon_opts = {
    key  : process.platform == 'linux' ? 'prey-agent' : 'com.prey.agent',
    path : paths.current,
    bin  : paths.current_bin,
    user : prey_user,
    name : 'Prey'
  }

  if (process.platform == 'linux') {
    // upstart init script needs to make it explicit that it isn't running on a terminal
    // and we also need to set the USER var so that system.get_running_user() works as expected.
    daemon_opts.env = { 'TERM': 'dumb', 'USER': prey_user };

    // upstart: start on startup and when exited with code 0, but only if not shutting down
    daemon_opts.up_start_on = 'startup or (stopped prey-agent EXIT_STATUS=0 and runlevel [2345])';

    // upstart: sleep 15 seconds after stopped, before restarting (e.g. when not stopped by upstart itself)
    daemon_opts.up_pre_stop_script  = 'echo "1" > /tmp/stopped-${JOB}';
    daemon_opts.up_post_stop_script = '[ ! -f "/tmp/stopped-${JOB}" ] && sleep 15\n  rm -f /tmp/stopped-${JOB}';

    // tell systemd to wait 15 seconds before restarting.
    // use sd_ prefix so we don't insert this into upstart scripts.
    daemon_opts.sd_respawn_wait = 15;

    // and lastly, tell systemd not to kill detached processes when the daemon stops.
    // this happens when using the default 'control-group' kill mode behaviour.
    daemon_opts.sd_kill_mode = 'process';

  } else { // osx

    // tell launchd to restart script whenever a change is detected in install dir
    daemon_opts.watch_paths = [ paths.install ];

    // in case the process exits with status code != 0 in less than 10 secs,
    // ensure that the respawn will wait.
    // NOTE: not using it anymore, codes != 0 should be restarted immediately
    // daemon_opts.respawn_wait = 15;
  }

}

exports.install = function(cb) {
  var next = function(err) {
    // EBUSY error is when file is being run. that shouldn't happen normally
    // but for the purposes of setting up the daemon, it doesn't really matter.
    if (err && err.code !== 'EBUSY') return cb(err);

    // satan ensures the daemon is destroyed before creating
    // a new one, so there's no need to perform that check now.
    satan.ensure_created(daemon_opts, function(err) {
      if (err) return cb(err);
      // wait one sec, then start. or half.
      setTimeout(function() {
        satan.start(daemon_opts.key, cb);
      }, 500);
    });
  }

  if (is_windows) {
    run('chcp 65001', function() {
      system.get_os_version(function(err, os_version) {
        try { greater = is_greater(os_version, '6.2'); }
        catch(e) { vers_err = e; }

        if (err || vers_err || greater == -1)
          service_bin = service_bin_old;

        fs.copyFile(service_bin, service_run_path, next);
      })
    });
  } else {
    next();
  }
}

exports.remove = function(cb) {
  satan.ensure_destroyed(daemon_opts.key, function(err) {
    if (err || !is_windows) return cb(err);

    fs.unlink(service_run_path, function(err) {
      // if (err) return cb(err);

      cb(); // don't mind if it wasn't there.
    });
  });
}

exports.set_watcher = function(cb) {
  exec(`${join(paths.current, 'bin', 'prey-user')} -v`, (error, prey_user_version) => {
    if (error) return;
    logger.info(`prey-user output: ${prey_user_version}`);
    queryStorage(prey_user_version, cb);
  });
}

const queryStorage = (preyUserVersion, cb) => {
  storage.do('query', {type: 'keys', column: 'id', data: 'prey_user_version'}, (err, stored_data) => {
    if (err || stored_data && stored_data.length == 0) activeWatcher(preyUserVersion, cb);
    else {
      if (!stored_data || stored_data.length < 0) return cb();
      const preyUserOldVersion = stored_data[0].value;
      if (is_greater_or_equal(preyUserOldVersion, preyUserVersion)) return cb();
      activeWatcher(preyUserVersion, cb);
    }
  });
}

const activeWatcher = (preyUserVersion, cb) => {
  storage.do('set', {type: 'keys', id: 'prey_user_version', data: {value: preyUserVersion}}, (err) => {
    if (err) return;
  });
  run(`/bin/cp ${join(paths.current, 'bin', 'prey-user')} ${paths.install} && rm ${join(paths.current, 'bin', 'prey-user')}`, () => {
    satan.status(watcher_opts.key, function(err, running) {
      satan.ensure_created(watcher_opts, function(err) {
        if (err) return;
        // wait one sec, then start. or half.
        if (running) return;
        setTimeout(function() {
          satan.start(watcher_opts.key, cb);
        }, 500);
      });
    });
  });
}

exports.remove_watcher = function(cb) {
  satan.ensure_destroyed(watcher_opts.key, function(err) {
    return cb && cb(err);
  });
}