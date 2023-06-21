/* eslint-disable import/no-dynamic-require */
const path = require('path');
const program = require('commander');
const common = require('./common');
const agent = require('.');
const pid = require('./utils/pidfile');

const { join } = path;
const rootPath = process.env.ROOT_PATH || join(__dirname, '..', '..');
const preyPackage = require(join(rootPath, 'package'));
const logger = common.logger.prefix('cli');

const { version } = preyPackage;
let pidfile = null; // null unless we do set one.

// fix stdout flushing error on windows
// https://github.com/joyent/node/issues/3584
require('clean-exit');

///
// command line options
///

program
  .name('prey')
  .version(version)
  .option(
    '-p, --path <path>',
    'Path to config file [/etc/prey or C:\\$WINDIR\\Prey]'
  )
  .option('-r, --run <command>', 'Run arbitrary command (eg. "get location")')
  .option(
    '-a, --allow-other',
    'Allow execution even if other instance is running.'
  )
  .option('-l, --logfile <logfile>', 'Logfile to use.')
  .option('-D, --debug', 'Output debugging info.')
  .option('-N, --node-version', 'Prints node version in use.')
  .parse(process.argv);

function warn(str, code) {
  if (process.stdout.writable) {
    process.stdout.write(`${str}\n`);
  }

  if (typeof code !== 'undefined') {
    process.exit(code);
  }
}

///
// event, signal handlers
///

function shutdown(code, wait) {
  let waitValue = wait || 10000;

  const die = (graceful) => {
    const msg = graceful ? 'Shutdown complete.' : "Time's up, shutdown forced.";
    logger.info(msg);
    process.exit(code);
  };

  // we should only remove the pidfile if the agent is really running
  // otherwise a second instance would remove the pidfile of the first one
  if (agent.running()) {
    logger.info(
      `Gracefully shutting down. Will self-destruct in ${waitValue / 1000} secs`
    );

    const timer = setTimeout(die, waitValue);

    if (pidfile) {
      pid.remove(pidfile);
    }

    agent.shutdown(() => {
      clearTimeout(timer);
      // wait a tad so that everything gets flushed.
      setTimeout(() => {
        die(true);
      }, 50);
    });
  }
}

function trapSignals() {
  process.on('exit', (code) => {
    shutdown(code);
  });

  // sent by other instance when updating config
  // SIGHUP is the default signal sent by Upstart when reloading a job.
  process.on('SIGHUP', () => {
    logger.warn('Got SIGHUP signal!');
    agent.reload();
  });

  // sent by Upstart
  process.on('SIGQUIT', () => {
    logger.warn('Got QUIT signal.');
    shutdown(0, 10000);
  });

  // sent by LaunchDaemon
  // we cannot exit with code 0 as LaunchDaemon
  // will assume the process exited normally.
  process.on('SIGTERM', () => {
    logger.warn('Got TERM signal.');
    shutdown(11, 10000);
  });

  // sent when developing. :)
  // 130 is the 'official' exit code in Bash for SIGINTs
  // eslint-disable-next-line consistent-return
  process.on('SIGINT', () => {
    if (!agent.running()) {
      logger.warn('Forcing shutting down');
      return process.exit(2);
    }

    logger.warn('Got INT signal.');
    shutdown(130, 5000);
  });

  process.on('uncaughtException', (err) => {
    logger.info(err.stack);
    logger.critical(`UNCAUGHT EXCEPTION: ${err.message || err}`);

    // Capture MacOS Big Sur ENETDOWN error for now...
    if (err.message === 'read ENETDOWN' || err === 'read ENETDOWN') {
      return;
    }

    if (!common.config.get('send_crash_reports')) {
      shutdown(1, 5000);
      return;
    }

    common.exceptions.send(err, () => {
      shutdown(1, 5000);
    });
  });
}

///
// launcher
///
// eslint-disable-next-line consistent-return
(() => {
  if (program.nodeVersion) {
    return warn(process.version, 0);
  }

  if (!common.config.present()) {
    warn("\nLooks like there's no config file yet");
    return warn(
      'To finish setting up Prey, please run `prey config hooks post_install` as root.\n',
      1
    );
  }

  trapSignals();

  if (program.allowOther || program.run) {
    return agent.run();
  }

  pidfile = common.pidFile;

  pid.store(pidfile, (err, running) => {
    let msg;
    let runTime;

    if (err) {
      msg =
        err.code === 'EPERM'
          ? `No write access to pidfile: ${pidfile}`
          : err.message;

      return logger.warn(`Cannot continue: ${msg}`, 1);
    }

    if (!running) {
      return agent.run();
    }

    if (process.stdout.writable) {
      logger.info('\n The Prey agent is running');
      runTime = (new Date() - running.stat.ctime) / (60 * 1000);
      if (running.stat && running.stat.ctime) {
        logger.info(
          ` It has been live for ${runTime
            .toString()
            .substring(0, 5)} minutes, under process ID ${running.pid}`
        );
      }
    }

    process.exit(10);
  });
})();
