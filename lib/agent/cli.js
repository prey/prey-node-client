/////////////////////////////////////////////////////////////
// Prey Node.js Client
// Written by Tomás Pollak
// (c) 2012, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
/////////////////////////////////////////////////////////////

var join        = require('path').join,
    root_path   = process.env.ROOT_PATH || join(__dirname, '..', '..'),
    version     = require(join(root_path, 'package')).version,
    program     = require('commander');

// fix stdout flushing error on windows
// https://github.com/joyent/node/issues/3584
require('clean-exit');

/////////////////////////////////////////////////////////////
// command line options
/////////////////////////////////////////////////////////////

program
   .name('prey')
   .version(version)
   .option('-p, --path <path>', 'Path to config file [/etc/prey or C:\\$WINDIR\\Prey]')
   .option('-r, --run <command>', 'Run arbitrary command (eg. "get location")')
   .option('-a, --allow-other', 'Allow execution even if other instance is running.')
   .option('-l, --logfile <logfile>', 'Logfile to use.')
   .option('-D, --debug', 'Output debugging info.')
   .option('-N, --node-version', 'Prints node version in use.')
   .parse(process.argv);

var common   = require('./common'),
    agent    = require('./'),
    pid      = require('./utils/pidfile'),
    logger   = common.logger,
    pidfile; // null unless we do set one.

function warn(str, code) {
  if (process.stdout.writable)
    process.stdout.write(str + '\n');

  if (typeof code != 'undefined')
    process.exit(code);
}

/////////////////////////////////////////////////////////////
// event, signal handlers
/////////////////////////////////////////////////////////////

function shutdown(code, wait) {
  var wait  = wait || 10000;

  var die   = function(graceful) {
    var msg = graceful ? 'Shutdown complete.' : "Time's up, shutdown forced.";
    logger.info(msg + ' Have a jolly good day sir.\n');
    process.exit(code);
  };

  // we should only remove the pidfile if the agent is really running
  // otherwise a second instance would remove the pidfile of the first one
  if (agent.running()) {
    logger.info('Gracefully shutting down. Will self-destruct in ' + wait/1000 + ' secs.');

    var timer = setTimeout(die, wait);
    if (pidfile) pid.remove(pidfile);

    agent.shutdown(function() {
      clearTimeout(timer);
      // wait a tad so that everything gets flushed.
      setTimeout(function() { die(true) }, 50);
    });
  }
}

function trap_signals() {

  process.on('exit', function(code) {
    shutdown(code);
  });

  // sent by other instance when updating config
  // SIGHUP is the default signal sent by Upstart when reloading a job.
  process.on('SIGHUP', function() {
    logger.warn('Got SIGHUP signal!');
    agent.reload();
  })

  // sent by Upstart
  process.on('SIGQUIT', function() {
    logger.warn('Got QUIT signal.');
    shutdown(0, 10000);
  });

  // sent by LaunchDaemon
  // we cannot exit with code 0 as LaunchDaemon
  // will assume the process exited normally.
  process.on('SIGTERM', function() {
    logger.warn('Got TERM signal.');
    shutdown(11, 10000);
  });

  // sent when developing. :)
  // 130 is the 'official' exit code in Bash for SIGINTs
  process.on('SIGINT', function() {
    if (!agent.running()) {
      logger.warn('Ok, ok, whatever you say.');
      return process.exit(2);
    }

    logger.warn('Got INT signal.');
    shutdown(130, 5000);
  });

  process.on('uncaughtException', function (err) {
    logger.info(err.stack);
    logger.critical('UNCAUGHT EXCEPTION: ' + (err.message || err));

    // Capture MacOS Big Sur ENETDOWN error for now...
    if (err.message == "read ENETDOWN" || err == "read ENETDOWN") return;

    if (!common.config.get('send_crash_reports'))
      return shutdown(1, 5000);

    common.exceptions.send(err, function() {
      shutdown(1, 5000);
    });
  });

}

////////////////////////////////////////////////////////////
// launcher
/////////////////////////////////////////////////////////////

(function() {

  if (program.nodeVersion) {
    return warn(process.version, 0);
  } else if (!common.config.present()) {
    warn('\nLooks like there\'s no config file yet. Glad to see you\'re getting started. :)');
    return warn('To finish setting up Prey, please run `prey config hooks post_install` as root.\n', 1);
  }

  trap_signals();

  if (process.argv[2] == 'console')
    program.mode = 'console';

  if (program.allowOther || program.run || program.mode == 'console') {
    return agent.run();
  }

  // if running in console mode, or using -a or -r, pidfile won't
  // be available for them to remove on process.exit().
  pidfile = common.pidFile;

  pid.store(pidfile, function(err, running) {
    if (err) {
      var msg = err.code == 'EPERM' ? 'No write access to pidfile: ' + pidfile : err.message;
      return warn('Cannot continue: ' + msg, 1);
    }

    if (!running) return agent.run();

    if (process.stdout.writable) {
      warn('\n The Prey agent is running. Good job!');

      if (running.stat && running.stat.ctime) {
        var run_time = (new Date() - running.stat.ctime)/(60 * 1000);
        var run_time_str = run_time.toString().substring(0,5);
        warn(' It has been live for ' + run_time_str + ' minutes, under process ID ' +  running.pid + '.');
      }

      warn(' To trigger actions or retrieve information, log in to your Prey account at https://preyproject.com');
      warn(' For additional configuration options, please run `prey config`.\n');
    }

    process.exit(10);
  });

})();
