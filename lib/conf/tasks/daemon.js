var fs         = require('fs'),
    satan      = require('satan'),
    paths      = require('./../../system/paths'),
    join       = require('path').join,
    cp         = require('../utils/cp').cp,
    is_windows = process.platform == 'win32';

var bin_path   = join(paths.current, 'bin'),
    prey_user  = 'prey';

if (is_windows) {

  var exe_name         = 'wpxsvc.exe',
      service_bin      = join(paths.current, 'lib', 'system', 'windows', 'bin', exe_name),
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
    path : paths.current,
    bin  : paths.current_bin,
    user : prey_user,
    name : 'Prey',
    wait : 15 // wait 15 seconds to restart, when exiting, to avoid overlaps with 'config upgrade's setTimeout()
  }

  if (process.platform == 'linux') {
    // upstart init script needs to make it explicit that it isn't running on a terminal
    // and we also need to set the USER var so that system.get_running_user() works as expected.
    daemon_opts.env = [{ key: 'TERM', value: 'dumb' }, { key: 'USER', value: prey_user }];
    daemon_opts.key = 'prey-agent';
  } else { // mac
    daemon_opts.key = 'com.prey.agent';
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
    cp(service_bin, service_run_path, next);
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
