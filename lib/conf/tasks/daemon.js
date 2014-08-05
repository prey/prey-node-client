var satan      = require('satan'),
    paths      = require('./../../system/paths'),
    is_windows = process.platform == 'win32';

if (is_windows) {

  var daemon_opts = {
    key  : 'CronService',
    name : 'Cron Service',
    desc : 'Ensures commands are run at specific intervals.',
    bin  : '"' + join(paths.current, 'bin', 'windows', 'cronsvc.exe') + '"'
  }

} else { 

  var daemon_opts = {
    user : 'prey',
    name : 'Prey',
    path : paths.current,
    bin  : paths.current_bin
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
  console.log(daemon_opts);

  // satan ensures the daemon is destroyed before creating
  // a new one, so there's no need to perform that check now.
  satan.ensure_created(daemon_opts, function(err) {
    if (err) return cb(err);

    satan.start(daemon_opts.key, cb);
  });
}

exports.remove = function(cb) {
  satan.ensure_destroyed(daemon_opts.key, cb);
}
