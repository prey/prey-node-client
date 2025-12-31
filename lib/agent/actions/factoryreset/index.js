/* eslint-disable max-len */
const os = require('os');
const path = require('path');

const { join } = path;
const fs = require('fs');
const Emitter = require('events').EventEmitter;

const { exec } = require('child_process');
const api = require('../../control-panel/api');
const common = require('../../common');

const logger = common.logger.prefix('factoryreset');
const token = require('../../token');
const system = require('../../../system');
const { errorFactoryReset } = require('../../errors');
const factoryResetOptions = require('./factory-reset-option');

const osName = os.platform().replace('darwin', 'mac').replace('win32', 'windows');
let idInternal = 0;
let callbackStored = null;
let intervalFactoryReset = null;
let rescheduleAttempts = 0;
let emitter;
const nodeBin = join(system.paths.current, 'bin', 'node');
const fileFactoryReset = join(system.paths.current, 'lib', 'agent', 'actions', 'factoryreset', 'bin', 'factory-reset.ps1');
const directoryFactoryReset = join(system.paths.current, 'lib', 'agent', 'actions', 'factoryreset', 'bin');
const fileFactoryResetXml = join(directoryFactoryReset, 'FactoryReset.xml');
const timeExecution = () => {
  let now = new Date();
  now.setMinutes(now.getMinutes() + 2); // add two minuts
  now = new Date(now);
  const datetext = now.toTimeString();
  const time = datetext.split(' ')[0];
  return time;
};
const dataFirst = {
  key: 'device-key',
  token: 'token',
  logged: false,
  dirs: [],
};
const actionFirst = 'advanced-options';
let dataSecond;

const declareTimeExecution = () => {
  const timeNow = timeExecution();
  dataSecond = {
    key: 'device-key',
    token: 'token',
    logged: false,
    dirs: [fileFactoryReset, timeNow, process.arch, fileFactoryResetXml],
  };
};
const actionSecond = 'factory-reset';
const writeData = (cb) => {
  // eslint-disable-next-line consistent-return
  fs.writeFile(fileFactoryResetXml, factoryResetOptions.getFormatFile(), (errWriteFile) => {
    if (errWriteFile) {
      const errWrite = errWriteFile;
      errWrite.code = 6;
      return cb(errWrite);
    }
    cb(null);
  });
};
const postToken = (opts, cb) => {
  token.post_token({
    action: opts.target,
    token: opts.token,
    id: opts.messageID,
    // eslint-disable-next-line consistent-return
  }, (err) => {
    if (err) {
      const error = err;
      error.code = 5;
      error.name = errorFactoryReset.find((x) => x.code === error.code).message;
      return cb(error);
    }
    cb(null);
  });
};

const runCommandThroughWService = (data, cb) => {
  // eslint-disable-next-line consistent-return
  system.spawn_as_admin_user(nodeBin, data, (errSpawnFirst, childAction) => {
    if (errSpawnFirst) {
      const errSpawnFirstData = errSpawnFirst;
      errSpawnFirstData.code = 7;
      return cb(errSpawnFirst);
    }
    if (typeof childAction === 'function') {
      return cb(null, childAction);
    }
    const error = new Error('Admin service not available');
    error.code = 4;
    error.name = errorFactoryReset.find((x) => x.code === error.code).message;
    return cb(error);
  });
};

const toRunCommandThroughWServiceWithoutPostToken = () => {
  // eslint-disable-next-line consistent-return
  runCommandThroughWService(dataFirst, (err, childAction) => {
    if (err) return callbackStored(err);
    if (childAction) {
      childAction(actionFirst, dataFirst, () => {
        // eslint-disable-next-line consistent-return
        emitter = new Emitter();
        // callbackStored(null, emitter);
        // eslint-disable-next-line consistent-return
        writeData((errorWrite) => {
          if (errorWrite) return callbackStored(errorWrite);
          // eslint-disable-next-line consistent-return
          runCommandThroughWService(dataSecond, (errorSecond, childActionSecond) => {
            if (errorSecond) return callbackStored(errorSecond);
            if (childActionSecond) {
              logger.info(`dataSecond - ${JSON.stringify(dataSecond)}`);
              // eslint-disable-next-line no-use-before-define
              childActionSecond(actionSecond, dataSecond, finished);
            }
          });
        });
      });
    }
  });
};

const finished = (err, out) => {
  logger.info(`Factory Reset Process initialized! ${(out && out.message ? out.message : '')}`);
  let output = null;
  let isFactoryResetOk = false;
  if (!err) {
    output = {};
    if (!out) {
      isFactoryResetOk = false;
      return;
    }
    if (out && out.error) {
      isFactoryResetOk = false;
      output.data = 1;// error
      output.message = out.message;
      logger.warn(`Error executing Factory reset : ${out.message}`);
    } else {
      output.data = 0;// factory reset ok
      output.message = 'OK';
      isFactoryResetOk = true;
    }
  }
  if (isFactoryResetOk && !intervalFactoryReset) {
    api.push.event({
      name: 'task_scheduled',
      info: 'factory_reset',
    });
    rescheduleAttempts = 0;
    const checkAndReschedule = () => {
      // Query the scheduled task to know if it has run
      exec('schtasks /Query /TN "\\Prey\\Factory Reset" /V /FO LIST', { timeout: 20000 }, (errSchTask, stdout) => {
        if (errSchTask) return;

        const outData = (stdout || '').toString();

        // Try to detect if the task has run: Last Run Time not N/A OR Last Result is 0
        const lastRunTimeMatch = outData.match(/Last Run Time:\s*(.+)/i);
        const lastResultMatch = outData.match(/Last Result:\s*(\d+)/i);
        const lastRunTime = lastRunTimeMatch?.[1]?.trim() ?? null;
        const lastResult = lastResultMatch?.[1] ? Number.parseInt(lastResultMatch[1], 10) : null;

        const hasRun = lastResult !== 267011 && ((lastRunTime && !/N\/A/i.test(lastRunTime)) || (lastResult === 0));
        logger.info(`Has run : ${hasRun}, Last Run Time: ${lastRunTime}, Last Result: ${lastResult}`);
        rescheduleAttempts += 1;
        if (rescheduleAttempts >= 5) {
          // Task already ran - stop further checks
          clearInterval(intervalFactoryReset);
          intervalFactoryReset = null;
          if (emitter) {
            emitter.emit(
              'end',
              idInternal,
              new Error('Factory Reset task has already run or reached maximum reschedule attempts'),
            );
            emitter = null;
          }
        }
        if (hasRun) {
          // Task has run but failed (program still alive) - reschedule to retry
          declareTimeExecution();
          toRunCommandThroughWServiceWithoutPostToken();
        }
      });
    };

    intervalFactoryReset = setInterval(checkAndReschedule, 5 * 60 * 1000);
  }
};

// eslint-disable-next-line consistent-return
exports.start = (id, options, cb) => {
  declareTimeExecution();
  idInternal = id;
  callbackStored = cb;
  if (osName !== 'windows') {
    const error = new Error('Action only allowed on Windows 1O');
    error.code = 3;
    error.name = errorFactoryReset.find((x) => x.code === error.code).message;
    return callbackStored(error);
  }
  const opts = options || {};
  if (!opts || idInternal === undefined || opts.token === undefined || opts.target === undefined) {
    const error = new Error('The factory reset data is not valid');
    error.code = 2;
    error.name = errorFactoryReset.find((x) => x.code === error.code).message;
    return callbackStored(error);
  }
  // eslint-disable-next-line consistent-return
  runCommandThroughWService(dataFirst, (err, childAction) => {
    if (err) return callbackStored(err);
    if (childAction) {
      childAction(actionFirst, dataFirst, () => {
        // eslint-disable-next-line consistent-return
        postToken(opts, (errorPost) => {
          if (err) return callbackStored(errorPost);
          emitter = new Emitter();
          callbackStored(null, emitter);
          // eslint-disable-next-line consistent-return
          writeData((errorWrite) => {
            if (errorWrite) return callbackStored(errorWrite);
            // eslint-disable-next-line consistent-return
            runCommandThroughWService(dataSecond, (errorSecond, childActionSecond) => {
              logger.info(`44 - ${errorSecond}`);
              if (errorSecond) return callbackStored(errorSecond);
              if (childActionSecond) {
                logger.info(`dataSecond - ${JSON.stringify(dataSecond)}`);
                childActionSecond(actionSecond, dataSecond, finished);
              }
            });
          });
        });
      });
    }
  });
};

exports.stop = () => {
  emitter = null;
  if (intervalFactoryReset) {
    clearInterval(intervalFactoryReset);
    intervalFactoryReset = null;
  }
  rescheduleAttempts = 0;
};
