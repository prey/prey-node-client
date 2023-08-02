///
// (c) 2023 - Prey Inc.
// Licensed under the GPLv3
///

const actions = require('./actions');
const commands = require('./commands');
const common = require('../common');
const controlPanel = require('./control-panel');
const hooks = require('./hooks');
const logo = require('./utils/logo');
const reports = require('./reports');
const providers = require('./providers');
const triggers = require('./triggers');
const updater = require('./updater');
const windowsLogger = require('./windows_logger');

// eslint-disable-next-line object-curly-newline
const { config, logger, program, osName } = common;
const exceptions = require('../exceptions');
const system = require('../system');

const watchList = [
  'connection',
  'control-zones',
  'hostname',
  'location',
  'network',
  'power',
  'status',
];

let running = false;
let startedAt = null;
let runningAs = null;

///
// helpers
///

const isRunning = () => running;

const writeHeader = () => {
  const write = (str, color) => {
    logger.write(logger.paint(str, color));
  };

  write(`\n${logo}`, 'grey');
  write(`\n  PREY ${common.version} spreads its wings!`, 'light_red');
  write(`  Current time: ${startedAt.toString()}`, 'bold');
  write(
    `  Running with PID ${process.pid} as ${runningAs} over Node.js ${process.version} on a ${process.arch} ${osName} system (${common.osRelease})\n`
  );
};

const isNetworkError = (err) => {
  const codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND'];
  return codes.indexOf(err.code) !== -1;
};

// eslint-disable-next-line consistent-return
const connectionDown = () => {
  if (!config.get('auto_connect')) {
    return false;
  }

  logger.notice('Lost connection. Trying to connect...');
};

const handleError = (err, source) => {
  logger.error(err, source);

  if (isNetworkError(err)) connectionDown();
  else if (config.get('send_crash_reports')) exceptions.send(err);
};

const boot = () => {
  hooks.on('error', handleError);

  controlPanel.load(() => {
    commands.run_stored(); // reload any actions previously in execution
    commands.start_watching(); // add/remove from list when started or stopped

    if (config.get('auto_update')) {
      updater.check_every(3 * 60 * 60 * 1000); // Every 3 hours allow checking for new releases
    }
    // We initialize the triggers after all the plugins have been enabled,
    // so the plugins that subscribed to events triggered by the watchers
    // work as intended: ie. control-panel's long-polling.
    triggers.watch(watchList);
  });
};

// eslint-disable-next-line consistent-return
const runFromCommandLine = () => {
  if (!program.debug) logger.pause();

  hooks.on('data', console.log);
  hooks.on('error', console.log);
  hooks.on('report', console.log);

  const parsed = commands.parse(program.run);
  if (!parsed) {
    return console.log('Invalid command.');
  }

  commands.perform(parsed[1]);
};

const run = () => {
  if (running) {
    return;
  }

  running = true;

  if (program.run) {
    // eslint-disable-next-line consistent-return
    return runFromCommandLine();
  }

  if (osName === 'windows') {
    windowsLogger.writeFileRestart();
    windowsLogger.countLinesRestarts();
  }
  process.title = 'prx'; // stealth camouflage FTW!

  // env.RUNNING_USER is user by the updater to check if it was called by the agent
  process.env.RUNNING_USER = system.get_running_user();
  runningAs = system.get_running_user();
  startedAt = new Date();
  writeHeader();

  if (!config.get('auto_update')) {
    // eslint-disable-next-line consistent-return
    return boot();
  }

  // eslint-disable-next-line consistent-return
  updater.check_for_update((err) => {
    if (err) {
      return boot();
    }

    logger.warn('Client updating process finished! Shutting down.');
  });
};

const reload = () => {
  logger.warn('Reloading!');
  config.reload();
};

///
// shutdown
///

const shutdown = () => {
  running = false;
  commands.stop_watching();
  updater.stop_checking();

  logger.debug('Stopping actions.');
  actions.stop_all();

  logger.debug('Unloading hooks.');
  hooks.unload();

  logger.debug('Canceling reports.');
  reports.cancel_all();

  logger.debug('Unwatching triggers.');
  triggers.unwatch();

  logger.debug('Cleaning up temporary files.');
  providers.remove_files();
};

///
// exports
///

exports.run = run;
exports.reload = reload;
exports.running = isRunning;
exports.shutdown = shutdown;
