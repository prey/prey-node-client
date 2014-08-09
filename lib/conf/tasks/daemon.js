var satan      = require('satan'),
    paths      = require('./../../system/paths'),
    join       = require('path').join,
    is_windows = process.platform == 'win32';

var bin_path   = join(paths.current, 'bin');

if (is_windows) {

  var daemon_opts = {
    path : paths.current,
    bin  : join(bin_path, 'node.exe'),
    args : join('lib', 'agent', 'cli.js'),
    key  : 'CronService',
    name : 'Cron Service',
    desc : 'Ensures commands are run at specific intervals.',
    daemon_path: paths.install, // e.g. C:\Windows\Prey
    daemon_name: 'cronsvc.exe'
  }

} else { 

  var daemon_opts = {
    path : paths.current,
    bin  : paths.current_bin,
    user : 'prey',
    name : 'Prey'
  }

  if (process.platform == 'linux') {
    // upstart init script needs to make it explicit that it isn't running on a terminal
    daemon_opts.env = [ {key: 'TERM', value: 'dumb'} ];
    daemon_opts.key = 'prey-agent';
  } else { // mac
    daemon_opts.key = 'com.prey.agent';
  }
  
}

exports.install = function(cb) {
  // satan ensures the daemon is destroyed before creating
  // a new one, so there's no need to perform that check now.
  satan.ensure_created(daemon_opts, function(err) {
    if (err) return cb(err);

    // wait one sec, then start.
    setTimeout(function() {
      satan.start(daemon_opts.key, cb);
    }, 500);
  });
}

exports.remove = function(cb) {
  satan.ensure_destroyed(daemon_opts.key, cb);
}
