const common = require('./common');
const updater = require('./updater');
const hooks = require('./hooks');
const commands = require('./commands');
const actions = require('./actions');
const triggers = require('./triggers');
const reports = require('./reports');
const providers = require('./providers');
const logo = require('./utils/logo');
const controlPanel = require('./control-panel');

const { config, system, logger, program, exceptions, os_name, os_release } = common;
const watchList = ['connection', 'control-zones', 'hostname', 'location', 'network', 'power', 'status'];
let running = false;
let started_at = null;
let running_as = null;

const isRunning = () => running;

const runFromCommandLine = () => {
  if (!program.debug) logger.pause();

  hooks.on('data', console.log);
  hooks.on('error', console.log);
  hooks.on('report', console.log);

  const parsed = commands.parse(program.run);
  if (!parsed) { return console.log('Invalid command.'); }

  commands.perform(parsed[1]);
};

const handleError = (err, source) => {
  logger.error(err, source);

  if (isNetworkError(err)) // no connection
  { connectionDown(); } else if (config.get('send_crash_reports')) { exceptions.send(err); }
};

const isNetworkError = (err) => {
  const codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND'];
  return codes.indexOf(err.code) !== -1;
};

const connectionDown = () => {
  if (!config.get('auto_connect')) { return false; }

  logger.notice('Lost connection. Trying to connect...');
};

const shutdown = function (cb) {
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

const reload = () => {
  logger.warn('Reloading!');
  config.reload();
};

const writeHeader = () => {
  function write(str, color) {
    logger.write(logger.paint(str, color));
  }

  write(`\n${logo}`, 'grey');
  const title = `\n  PREY ${common.version} spreads its wings!`;
  write(title, 'light_red');
  write(`  Current time: ${started_at.toString()}`, 'bold');
  write(`  Running with PID ${process.pid} as ${running_as} over Node.js ${process.version} on a ${process.arch}, ${os_name} system (${os_release}) \n`);
};

const boot = () => {
  hooks.on('error', handleError);
  controlPanel.load(() => {
    commands.run_stored();
    commands.start_watching();

    if (config.get('auto_update'))
      updater.check_every(3 * 60 * 60 * 1000);

    logger.info('Initialized.');
    triggers.watch(watchList);
  });
};

const run = () => {
  if (running) return;
  running = true;

  if (program.run) return runFromCommandLine();

  common.writeFileLoggerRestart((Math.floor(new Date().getTime() / 1000)).toString()); // why this is just 4 windows in the refactor?
  common.countLinesLoggerRestarts(); // why this is just 4 windows in the refactor?
  process.title = 'prx'; // stealth camouflage FTW!

  // env.RUNNING_USER is user by the updater to check if it was called by the agent
  process.env.RUNNING_USER = system.get_running_user();
  running_as = system.get_running_user();
  started_at = new Date();
  writeHeader();

  if (!config.get('auto_update')) return boot();

  updater.check_for_update((err) => {
    if (err) return boot();

    logger.warn('Client updating process finished! Shutting down.');
  });
};

exports.run = run;
exports.reload = reload;
exports.running = isRunning;
exports.shutdown = shutdown;
