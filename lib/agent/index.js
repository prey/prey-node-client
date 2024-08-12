const common = require('./common');
const updater = require('./updater');
const hooks = require('./hooks');
const commands = require('./commands');
const actions = require('./actions');
const triggers = require('./triggers');
const reports = require('./reports');
const providers = require('./providers');

const {
  correctPreyConf, correctDeviceKeyConf, getDataDb, readWithoutVerification,
} = require('./utils/prey-configuration/preyconf');
const storage = require('./utils/storage');
const { restore } = require('./utils/storage/restore');
const setup = require('./control-panel/setup');

const logo = require('./utils/logo');
const controlPanel = require('./control-panel');

const {
  // eslint-disable-next-line camelcase
  system, logger, program, exceptions, os_name, os_release,
} = common;
const config = require('../utils/configfile');
const fetchEnvVar = require('../utils/fetch-env-var');

const watchList = ['connection', 'control-zones', 'hostname', 'location', 'network', 'power', 'status'];
let running = false;
let startedAt = null;
let runningAs = null;

const isRunning = () => running;

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
  logger.debug(JSON.stringify(fetchEnvVar('all')));
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

const hasDeviceKeyApiKey = (cb) => {
  try {
    const apiKey = config.getData('control-panel.api_key');
    const deviceKey = config.getData('control-panel.device_key');
    if (apiKey && apiKey !== '' && (deviceKey === undefined || deviceKey === null || deviceKey === '')) {
      setup.start(common, () => {
        cb();
      });
    } else cb();
  } catch (exception) {
    logger.info(`Error in hasDeviceKeyApiKey: ${exception}`);
    cb();
  }
};

const getDataFromShouldPreyCFile = (cb) => {
  getDataDb('shouldPreyCFile', (errorGetData, dataFromDb) => {
    if (errorGetData) return cb(errorGetData, null);
    if (dataFromDb && dataFromDb.length > 0) {
      return cb(null, dataFromDb[0].value);
    }
    return cb(null, null);
  });
};

const reactToDataFromShouldPreyCFile = (errGetShouldInside, dataShouldInside) => {
  if (errGetShouldInside) return;
  if (dataShouldInside && dataShouldInside.localeCompare('true') !== 0) {
    storage.do('update', {
      type: 'keys', id: 'shouldPreyCFile', columns: 'value', values: 'true',
    }, (errUpdate) => {
      if (errUpdate) logger.error(`Error while updating inside preyConfReconf: ${errUpdate}`);
    });
  } else if (!dataShouldInside) {
    storage.do('set', { type: 'keys', id: 'shouldPreyCFile', data: { value: 'true' } }, (errSetting) => {
      if (errSetting) logger.error(`Error while setting preyConfReconf: ${errSetting}`);
    });
  }
};
const actionForDataWithoutVerification = (errReadWithoutVerification, data) => {
  if (errReadWithoutVerification) return;
  if (data['control-panel.device_key'] && data['control-panel.api_key']) {
    config.setData('control-panel.api_key', data['control-panel.api_key'], () => {
      config.setData('control-panel.device_key', data['control-panel.device_key'], () => {
        getDataFromShouldPreyCFile(reactToDataFromShouldPreyCFile);
      });
    });
  }
};

const correctDataTimedOut = () => correctPreyConf(config.all(), () => {});

const preyConfReconf = () => {
  getDataFromShouldPreyCFile((_err, shouldPreyCFile) => {
    if (shouldPreyCFile && shouldPreyCFile.localeCompare('true') === 0) {
      setTimeout(correctDataTimedOut, 1000 * 60 * 5);
      setInterval(correctDataTimedOut, 1000 * 60 * 30);
    } else {
      // eslint-disable-next-line consistent-return
      getDataDb('preyconf', (_errorGetData, dataFromDb) => {
        if (dataFromDb && dataFromDb.length > 0) {
          const preyConfData = JSON.parse(dataFromDb[0].value);
          if (preyConfData['control-panel.device_key'] && preyConfData['control-panel.api_key']) {
            return getDataFromShouldPreyCFile(reactToDataFromShouldPreyCFile);
          }
          setInterval(() => {
            getDataFromShouldPreyCFile((errGetShould, dataShould) => {
              getDataDb('preyconf', (errorGetData, dataFromDbInside) => {
                if (errorGetData) return;
                if (dataFromDbInside && dataFromDbInside.length > 0) {
                  const preyConfDataInside = JSON.parse(dataFromDbInside[0].value);
                  if ((!dataShould || dataShould.localeCompare('false') === 0)
                    && preyConfDataInside['control-panel.device_key'] && preyConfDataInside['control-panel.api_key']) {
                    // eslint-disable-next-line consistent-return
                    return getDataFromShouldPreyCFile(reactToDataFromShouldPreyCFile);
                  }
                }
              });
              if (errGetShould) return;
              if (dataShould && dataShould.localeCompare('true') === 0) {
                return;
              }
              readWithoutVerification(actionForDataWithoutVerification);
            });
          }, 1000 * 30);
        }
      });
    }
  });
};
const run = () => {
  if (running) return;
  running = true;

  // eslint-disable-next-line consistent-return
  if (program.run) { return runFromCommandLine(); }
  // eslint-disable-next-line consistent-return
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

    preyConfReconf();
    try {
      hasDeviceKeyApiKey(() => {
        updater.check_for_update((err) => {
          // eslint-disable-next-line consistent-return
          restore((msg) => {
            if (typeof msg === 'string') logger.info(msg);
            // eslint-disable-next-line consistent-return
            if (err) return boot();
          });
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
