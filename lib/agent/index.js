const common = require('./common');
const updater = require('./updater');
const hooks = require('./hooks');
const commands = require('./commands');
const actions = require('./actions');
const triggers = require('./triggers');
const reports = require('./reports');
const providers = require('./providers');
const {
  startVerifyPreyConf,
  verifyPreyConfData,
  correctDeviceKeyConf,
  getDataDb,
  correctPreyConf,
  trySaveData,
} = require('./utils/prey-configuration/preyconf');
const storage = require('./utils/storage');
const { restore } = require('./utils/storage/restore');

const logo = require('./utils/logo');
const controlPanel = require('./control-panel');

const {
  config, system, logger, program, exceptions, os_name, os_release,
} = common;
const watchList = ['connection', 'control-zones', 'hostname', 'location', 'network', 'power', 'status'];
let running = false;
let startedAt = null;
let runningAs = null;
let dbPreyConfInterval;

const isRunning = () => running;

const AllLooksGoods = (cb) => {
  logger.info('Everything looks good with PreyConf!');
  cb();
};

/// /////////////////////////////////////////////////////////////////
// helpers
/// /////////////////////////////////////////////////////////////////

/// /////////////////////////////////////////////////////////////////
// bootup
/// /////////////////////////////////////////////////////////////////

const getDataDbPreyConfRestart = (callback) => {
  try {
    storage.do('query', { type: 'keys', column: 'id', data: 'restarts_preyconf' }, (err, stored) => {
      if (err) {
        return callback(err, null);
      }
      if (stored && stored.length > 0) {
        return callback(null, stored);
      }
      return callback(null, null);
    });
  } catch (e) {
    logger.error(`Error getDataDbPreyConfRestart: ${e}`);
  }
};

const saveDataDbPreyConfRestart = (stored, callback) => {
  try {
    if (stored && stored.length > 0) {
      storage.do('update', {
        type: 'keys', id: 'restarts_preyconf', columns: 'value', values: parseInt(stored, 10).toString(),
      // eslint-disable-next-line consistent-return
      }, (errUpdate) => {
        if (errUpdate) {
          logger.error(`Error while updating restarts_preyconf: ${errUpdate}`);
          return callback(errUpdate, null);
        }
        callback(null, (parseInt(stored[0].value, 10) + 1));
      });
    } else {
      storage.do('set', { type: 'keys', id: 'restarts_preyconf', data: { value: parseInt(stored, 10).toString() } }, (errSetting) => {
        if (errSetting) {
          logger.error(`Error while setting restarts_preyconf: ${errSetting}`);
          return callback(errSetting, null);
        }
        return callback(null, 1);
      });
    }
  } catch (e) {
    logger.error(`Error getPreyConf: ${e}`);
  }
};

// eslint-disable-next-line consistent-return
const getRestartsPreyconf = (callback) => {
  try {
    // eslint-disable-next-line consistent-return
    getDataDbPreyConfRestart((err, stored) => {
      if (err) {
        logger.error(`Error while querying db for restarts_preyconf: ${err}`);
        return callback(err, null);
      }
      if (stored && stored.length > 0) {
        storage.do('update', {
          type: 'keys', id: 'restarts_preyconf', columns: 'value', values: (parseInt(stored[0].value, 10) + 1).toString(),
        // eslint-disable-next-line consistent-return
        }, (errUpdate) => {
          if (errUpdate) {
            logger.error(`Error while updating restarts_preyconf: ${errUpdate}`);
            return callback(errUpdate, null);
          }
          callback(null, (parseInt(stored[0].value, 10) + 1));
        });
      } else {
        storage.do('set', { type: 'keys', id: 'restarts_preyconf', data: { value: '1' } }, (errSetting) => {
          if (errSetting) {
            logger.error(`Error while setting restarts_preyconf: ${errSetting}`);
            return callback(errSetting, null);
          }
          return callback(null, 1);
        });
      }
    });
  } catch (e) {
    logger.error(`Error getRestartsPreyconf: ${e}`);
    return callback(null, 1);
  }
};

const correctPreyConfCallback = (callback) => {
  getDataDb((err, data) => {
    if (err || !data) {
      callback();
    } else if (!err && data) {
      // eslint-disable-next-line no-prototype-builtins
      if (data.length === 0 || !data[0] || (typeof (data[0]) === 'object' && !data[0].hasOwnProperty('value'))) {
        callback();
      } else {
        const jsonData = JSON.parse(data[0].value);
        correctPreyConf(jsonData, () => {
          getRestartsPreyconf((errRestartPreyConf, dataRestart) => {
            if (errRestartPreyConf || !dataRestart) callback();
            if (dataRestart < 2) process.exit(0);
            else callback();
          });
        });
      }
    }
  });
};

const runVerificationPreyConfiguration = (callback) => {
  try {
    if (dbPreyConfInterval) clearInterval(dbPreyConfInterval);
    trySaveData();
    dbPreyConfInterval = setInterval(trySaveData, 60 * 60 * 1000);
    const verifiedPreyConf = startVerifyPreyConf();
    if (!verifiedPreyConf.constitution) {
      logger.info('There is an error on Preyconf, Repairing!');
      correctPreyConfCallback(callback);
    } else if (verifiedPreyConf.apiKeyValue && !verifiedPreyConf.deviceKeyValue) {
      correctDeviceKeyConf((errCorrectDeviceKey) => {
        if (errCorrectDeviceKey) logger.warn(`there was an error: ${JSON.stringify(errCorrectDeviceKey)}`);
        callback();
      });
    } else if (verifiedPreyConf.constitution) {
      try {
        const verifiedPreyConfData = verifyPreyConfData();
        if (verifiedPreyConfData === true) AllLooksGoods(callback);
        else correctPreyConfCallback(callback);
      } catch (errorVerifiedPreyConfData) {
        logger.warn(`there was an error: ${JSON.stringify(errorVerifiedPreyConfData)}`);
        correctPreyConfCallback(callback);
      }
    } else AllLooksGoods(callback);
  } catch (errorVerifyingPreyConf) {
    logger.warn(`there was an error: ${JSON.stringify(errorVerifyingPreyConf)}`);
    callback();
  }
};

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
  if (!config.get('auto_connect')) { return false; }

  logger.notice('Lost connection. Trying to connect...');
};
const handleError = (err, source) => {
  logger.error(err, source);
  // no connection
  if (isNetworkError(err)) connectionDown();
  else if (config.get('send_crash_reports')) exceptions.send(err);
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
  if (dbPreyConfInterval) clearInterval(dbPreyConfInterval);
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
  write(`  Current time: ${startedAt.toString()}`, 'bold');
  write(`  Running with PID ${process.pid} as ${runningAs} over Node.js ${process.version} on a ${process.arch}, ${os_name} system (${os_release}) \n`);
};

const boot = () => {
  hooks.on('error', handleError);
  controlPanel.load(() => {
    commands.run_stored();
    commands.start_watching();

    if (config.get('auto_update')) updater.check_every(3 * 60 * 60 * 1000);

    logger.info('Initialized.');
    triggers.watch(watchList);
  });
};

const run = () => {
  if (running) return;
  running = true;

  // eslint-disable-next-line consistent-return
  if (program.run) { return runFromCommandLine(); }

  common.writeFileLoggerRestart((Math.floor(new Date().getTime() / 1000)).toString());
  common.countLinesLoggerRestarts();
  process.title = 'prx'; // stealth camouflage FTW!

  // env.RUNNING_USER is user by the updater to check if it was called by the agent
  process.env.RUNNING_USER = system.get_running_user();
  runningAs = system.get_running_user();
  startedAt = new Date();
  writeHeader();

  // eslint-disable-next-line consistent-return
  if (config.get('auto_update') === false) return boot();
  runVerificationPreyConfiguration(() => {
    updater.check_for_update((err) => {
      restore((msg) => {
        // eslint-disable-next-line consistent-return
        saveDataDbPreyConfRestart('0', () => {
          if (typeof msg === 'string') logger.info(msg);
          if (err) return boot();
          logger.warn('Client updating process finished! Shutting down.');
        });
      });
    });
  });
};

exports.run = run;
exports.reload = reload;
exports.running = isRunning;
exports.shutdown = shutdown;
