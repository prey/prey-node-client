const common = require('./common');
const updater = require('./updater');
const hooks = require('./hooks');
const commands = require('./commands');
const actions = require('./actions');
const triggers = require('./triggers');
const reports = require('./reports');
const providers = require('./providers');
const {
  runVerificationPreyConfiguration,
  saveDataDbPreyConfRestart,
  clearIntervalDbPreyConf,
} = require('./utils/prey-configuration/validationpreyconf');
const { restore } = require('./utils/storage/restore');

const logo = require('./utils/logo');
const controlPanel = require('./control-panel');

const {
  // eslint-disable-next-line camelcase
  system, logger, program, exceptions, os_name, os_release,
} = common;
const config = require('../utils/configfile');

const watchList = ['connection', 'control-zones', 'hostname', 'location', 'network', 'power', 'status'];
let running = false;
let startedAt = null;
let runningAs = null;

const isRunning = () => running;

/// /////////////////////////////////////////////////////////////////
// helpers
/// /////////////////////////////////////////////////////////////////

/// /////////////////////////////////////////////////////////////////
// bootup
/// /////////////////////////////////////////////////////////////////
/// /////////////////////////////////////////////////////////////////
// commands, response
/// /////////////////////////////////////////////////////////////////

// eslint-disable-next-line consistent-return
const runFromCommandLine = () => {
  if (!program.debug) logger.pause();

  hooks.on('data', console.log);
  hooks.on('error', console.log);
  hooks.on('report', console.log);

  const parsed = commands.parse(program.run);
  if (!parsed) { return console.log('Invalid command.'); }

  commands.perform(parsed[1]);
};

const isNetworkError = (err) => {
  const codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND'];
  return codes.indexOf(err.code) !== -1;
};

// eslint-disable-next-line consistent-return
const connectionDown = () => {
  if (!config.getData('auto_connect')) { return false; }

  logger.notice('Lost connection. Trying to connect...');
};
const handleError = (err, source) => {
  logger.error(err, source);
  // no connection
  if (isNetworkError(err)) connectionDown();
  else if (config.getData('send_crash_reports')) exceptions.send(err);
};

const shutdown = function () {
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
  clearIntervalDbPreyConf();
};

const reload = () => {
  logger.warn('Reloading!');
  config.load();
};

const writeHeader = () => {
  function write(str, color) {
    logger.write(logger.paint(str, color));
  }

  write(`\n${logo}`, 'grey');
  const title = `\n  PREY ${common.version} spreads its wings!`;
  write(title, 'light_red');
  write(`  Current time: ${startedAt.toString()}`, 'bold');
  // eslint-disable-next-line camelcase
  write(`  Running with PID ${process.pid} as ${runningAs} over Node.js ${process.version} on a ${process.arch}, ${os_name} system (${os_release}) \n`);
};

const boot = () => {
  hooks.on('error', handleError);
  controlPanel.load(() => {
    commands.run_stored();
    commands.start_watching();

    if (config.getData('auto_update')) updater.check_every(3 * 60 * 60 * 1000);

    logger.info('Initialized.');
    triggers.watch(watchList);
  });
};

const run = () => {
  if (running) return;
  running = true;

  // eslint-disable-next-line consistent-return
  if (program.run) { return runFromCommandLine(); }
  config.load(() => {
    common.writeFileLoggerRestart((Math.floor(new Date().getTime() / 1000)).toString());
    common.countLinesLoggerRestarts();
    process.title = 'prx'; // stealth camouflage FTW!

    // env.RUNNING_USER is user by the updater to check if it was called by the agent
    process.env.RUNNING_USER = system.get_running_user();
    runningAs = system.get_running_user();
    startedAt = new Date();
    writeHeader();

    // eslint-disable-next-line consistent-return
    if (config.getData('auto_update') === false) return boot();

    try {
      updater.check_for_update((err) => {
        restore((msg) => {
          if (typeof msg === 'string') logger.info(msg);
          // eslint-disable-next-line consistent-return
          if (err) return boot();
        });
      });
    } catch (exception) {
      boot();
    }
  });
};

exports.run = run;
exports.reload = reload;
exports.running = isRunning;
exports.shutdown = shutdown;
