/// //////////////////////////////////////////////////////////
// Prey Node.js Client
// Written by Tomás Pollak
// (c) 2011-2014, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
/// //////////////////////////////////////////////////////////

const common = require('./common');
const updater = require('./updater');
const hooks = require('./hooks');
const plugin = require('./plugin');
const commands = require('./commands');
const actions = require('./actions');
const triggers = require('./triggers');
const reports = require('./reports');
const providers = require('./providers');
const shared = require('../conf/shared');
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

const os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const logo = require('./utils/logo');

const { config } = common;
const { system } = common;
const { logger } = common;
const { program } = common;
const { helpers } = common;
const { exceptions } = common;
const { plugins } = common;
const watch_list = ['connection', 'control-zones', 'hostname', 'location', 'network', 'power', 'status'];
let running = false;
let started_at = null;
let running_as = null;
let dbPreyConfInterval;

const loaded_plugins = [];

/// /////////////////////////////////////////////////////////////////
// helpers
/// /////////////////////////////////////////////////////////////////

const is_running = function () {
  return running;
};

const write_header = function () {
  function write(str, color) {
    logger.write(logger.paint(str, color));
  }

  write(`\n${logo}`, 'grey');
  const title = `\n  PREY ${common.version} spreads its wings!`;
  write(title, 'light_red');
  write(`  Current time: ${started_at.toString()}`, 'bold');

  let info = `  Running with PID ${process.pid} as ${running_as} over Node.js ${process.version}`;
  info += `${[' on a', process.arch, common.os_name, 'system', `(${common.os_release})`].join(' ')}\n`;

  write(info);
};

/// /////////////////////////////////////////////////////////////////
// bootup
/// /////////////////////////////////////////////////////////////////
const boot = function () {
  hooks.on('error', handle_error);

  load_plugins(plugins.get_enabled(), (err) => {
    if (err) throw err;

    commands.run_stored(); // reload any actions previously in execution
    commands.start_watching(); // add/remove from list when started or stopped

    if (config.get('auto_update')) { updater.check_every(3 * 60 * 60 * 1000); } // Every 3 hours allow checking for new releases

    logger.info('Initialized.');
    // We initialize the triggers after all the plugins have been enabled,
    // so the plugins that subscribed to events triggered by the watchers
    // work as intended: ie. control-panel's long-polling.
    triggers.watch(watch_list);
  });
};

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
        type: 'keys', id: 'restarts_preyconf', columns: 'value', values: parseInt(stored).toString(),
      }, (errUpdate) => {
        if (errUpdate) {
          logger.error(`Error while updating restarts_preyconf: ${errUpdate}`);
          return callback(errUpdate, null);
        }
        callback(null, (parseInt(stored[0].value) + 1));
      });
    } else {
      storage.do('set', { type: 'keys', id: 'restarts_preyconf', data: { value: parseInt(stored).toString() } }, (errSetting) => {
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

const getRestartsPreyconf = (callback) => {
  try {
    getDataDbPreyConfRestart((err, stored) => {
      if (err) {
        logger.error(`Error while querying db for restarts_preyconf: ${err}`);
        return callback(err, null);
      }
      if (stored && stored.length > 0) {
        storage.do('update', {
          type: 'keys', id: 'restarts_preyconf', columns: 'value', values: (parseInt(stored[0].value) + 1).toString(),
        }, (errUpdate) => {
          if (errUpdate) {
            logger.error(`Error while updating restarts_preyconf: ${errUpdate}`);
            return callback(errUpdate, null);
          }
          callback(null, (parseInt(stored[0].value) + 1));
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
          getRestartsPreyconf((err, data) => {
            if (err || !data) callback();
            if (data < 2) process.exit(0);
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
      correctPreyConfCallback(callback);
    } else if (verifiedPreyConf.apiKeyValue && !verifiedPreyConf.deviceKeyValue) {
      correctDeviceKeyConf((errCorrectDeviceKey) => {
        if (errCorrectDeviceKey) logger.warn(`there was an error: ${JSON.stringify(errCorrectDeviceKey)}`);
        callback();
      });
    } else if (verifiedPreyConf.constitution) {
      try {
        const verifiedPreyConfData = verifyPreyConfData();
        if (verifiedPreyConfData === true) callback();
        else correctPreyConfCallback(callback);
      } catch (errorVerifiedPreyConfData) {
        logger.warn(`there was an error: ${JSON.stringify(errorVerifiedPreyConfData)}`);
        correctPreyConfCallback(callback);
      }
    } else callback();
  } catch (errorVerifyingPreyConf) {
    logger.warn(`there was an error: ${JSON.stringify(errorVerifyingPreyConf)}`);
    callback();
  }
};

const run = function () {
  if (running) return;
  running = true;

  if (program.run) { return run_from_command_line(); }

  common.writeFileLoggerRestart((Math.floor(new Date().getTime() / 1000)).toString());
  common.countLinesLoggerRestarts();
  process.title = 'prx'; // stealth camouflage FTW!

  // env.RUNNING_USER is user by the updater to check if it was called by the agent
  running_as = process.env.RUNNING_USER = common.system.get_running_user();
  started_at = new Date();
  write_header();

  if (program.mode === 'console') { return load_plugin('console'); }
  if (!config.get('auto_update')) return boot();
  runVerificationPreyConfiguration(() => {
    updater.check_for_update((err) => {
      restore((msg) => {
        saveDataDbPreyConfRestart('0', () => {
          if (typeof msg === 'string') logger.info(msg);
          if (err) return boot();
          logger.warn('Client updating process finished! Shutting down.');
        });
      });
    });
  });
};

const reload = function () {
  logger.warn('Reloading!');
  config.reload();

  unload_plugins(() => {
    load_plugins(plugins.get_enabled(), (err) => {
      if (err) handle_error(err);

      logger.notice('Reload complete.');
    });
  });
};

var load_plugins = function (list, cb) {
  if (!list || !list[0]) { return cb(new Error('No plugins set!')); }

  let count = list.length;
  const errors = [];

  const done = function (err, name) {
    if (err) {
      handle_error(err, name);
      errors.push(err);
    }
    --count || finished();
  };

  var finished = function () {
    logger.info(`${list.length} plugins loaded with ${errors.length} errors.`);
    const success = list.length > errors.length; // at least one succeeded
    cb(!success && errors[0]);
  };

  list.forEach((name) => {
    load_plugin(name, done);
  });
};

var load_plugin = function (name, cb) {
  plugin.load(name, (err) => {
    if (err) {
      if (err.code == 'MODULE_NOT_FOUND') { return plugins.remove(name, cb); }

      return cb && cb(err, name);
    }

    logger.info(`Plugin loaded: ${name}`);
    loaded_plugins.push(name);
    cb && cb(null, name);
  });
};

/// /////////////////////////////////////////////////////////////////
// commands, response
/// /////////////////////////////////////////////////////////////////

var run_from_command_line = function () {
  if (!program.debug) logger.pause();

  hooks.on('data', console.log);
  hooks.on('error', console.log);
  hooks.on('report', console.log);

  const parsed = commands.parse(program.run);
  if (!parsed) { return console.log('Invalid command.'); }

  commands.perform(parsed[1]);
};

/// /////////////////////////////////////////////////////////////////
// hooks and error handling
/// /////////////////////////////////////////////////////////////////

var handle_error = function (err, source) {
  logger.error(err, source);

  if (is_network_error(err)) // no connection
  { connection_down(); } else if (config.get('send_crash_reports')) { exceptions.send(err); }
};

var is_network_error = function (err) {
  const codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND'];
  return codes.indexOf(err.code) !== -1;
};

var connection_down = function () {
  if (!config.get('auto_connect')) { return false; }

  logger.notice('Lost connection. Trying to connect...');
};

/// /////////////////////////////////////////////////////////////////
// shutdown
/// /////////////////////////////////////////////////////////////////

const shutdown = function (cb) {
  // if a plugin was loaded after unload_plugins() was called
  // we need to be able to call unload() on it again. so we need to comment this.
  // if (!running) return;

  running = false;
  commands.stop_watching();
  updater.stop_checking();

  logger.debug('Unloading plugins.');
  unload_plugins(cb);

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

var unload_plugins = function (cb) {
  let count = loaded_plugins.length;

  loaded_plugins.forEach(unload);

  function unload(name) {
    logger.debug(`Unloading ${name} plugin...`);
    plugin.unload(name, (err) => {
      done(err, name);
    });
  }

  function done(err, name) {
    logger.debug(`Plugin unloaded: ${name}`);

    // MUTANT THING HERE. for some reason if we uncomment
    // these two lines, some (and only some) plugins will fail to be unloaded.
    // in other words, it makes the unload() function complete vanish without
    // leaving any traces. try/catch doesn't help.
    // var index = loaded_plugins.indexOf(name);
    // loaded_plugins.splice(index, 1);

    --count || (cb && cb());
  }
};

/// /////////////////////////////////////////////////////////////////
// exports
/// /////////////////////////////////////////////////////////////////

exports.run = run;
exports.reload = reload;
exports.running = is_running;
exports.shutdown = shutdown;
