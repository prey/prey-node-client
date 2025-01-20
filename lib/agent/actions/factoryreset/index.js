const os = require('os');
const path = require('path');

const { join } = path;
const fs = require('fs');
const Emitter = require('events').EventEmitter;
const common = require('../../common');

const logger = common.logger.prefix('factoryreset');
const token = require('../../token');
const system = require('../../../system');
const { errorFactoryReset } = require('../../errors');
const factoryResetOptions = require('./factory-reset-option');

const osName = os.platform().replace('darwin', 'mac').replace('win32', 'windows');
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
const dataSecond = {
  key: 'device-key',
  token: 'token',
  logged: false,
  dirs: [fileFactoryReset, timeExecution(), process.arch, fileFactoryResetXml],
};
const actionSecond = 'factory-reset';
const writeData = (cb) => {
  // eslint-disable-next-line consistent-return
  fs.writeFile(fileFactoryResetXml, factoryResetOptions.format_file, (errWriteFile) => {
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
      logger.info(`Error executing Factory Reset :${JSON.stringify(errSpawnFirstData)}`);
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
// eslint-disable-next-line consistent-return
exports.start = (id, options, cb) => {
  if (osName !== 'windows') {
    const error = new Error('Action only allowed on Windows 1O');
    error.code = 3;
    error.name = errorFactoryReset.find((x) => x.code === error.code).message;
    return cb(error);
  }
  const opts = options || {};
  if (!opts || id === undefined || opts.token === undefined || opts.target === undefined) {
    const error = new Error('The factory reset data is not valid');
    error.code = 2;
    error.name = errorFactoryReset.find((x) => x.code === error.code).message;
    return cb(error);
  }
  const finished = (err, out) => {
    logger.info('Factory Reset Process initialized!');
    let output = null;
    if (!err) {
      output = {};
      if (!out) return emitter.emit('end', id);
      if (out && out.error) {
        output.data = 1;// error
        output.message = out.message;
        logger.warn(`Error executing Factory reset : ${out.message}`);
      } else {
        output.data = 0;// factory reset ok
        output.message = 'OK';
      }
    }
    // eslint-disable-next-line consistent-return
    if (!emitter) return;
    return emitter.emit('end', id, err, output);
  };
  // eslint-disable-next-line consistent-return
  runCommandThroughWService(dataFirst, (err, childAction) => {
    if (err) return cb(err);
    if (childAction) {
      childAction(actionFirst, dataFirst, () => {
        // eslint-disable-next-line consistent-return
        postToken(opts, (errorPost) => {
          if (err) return cb(errorPost);
          emitter = new Emitter();
          cb(null, emitter);
          // eslint-disable-next-line consistent-return
          writeData((errorWrite) => {
            if (errorWrite) return cb(errorWrite);
            // eslint-disable-next-line consistent-return
            runCommandThroughWService(dataSecond, (errorSecond, childActionSecond) => {
              if (errorSecond) return cb(errorSecond);
              if (childActionSecond) {
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
};
