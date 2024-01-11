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
const factory_reset_options = require('./factory-reset-option');

let emitter;
let action;
const node_bin = join(system.paths.current, 'bin', 'node');
const file_factory_reset = join(system.paths.current, 'lib', 'agent', 'actions', 'factoryreset', 'bin', 'factory-reset.ps1');
const directory_factory_reset = join(system.paths.current, 'lib', 'agent', 'actions', 'factoryreset', 'bin');
const file_factory_reset_xml = join(directory_factory_reset, 'FactoryReset.xml');

const time_execution = () => {
  let now = new Date();
  now.setMinutes(now.getMinutes() + 2); // add two minuts
  now = new Date(now);
  const datetext = now.toTimeString();
  const time = datetext.split(' ')[0];
  return time;
};

exports.start = function (id, options, cb) {
  const osName = os.platform().replace('darwin', 'mac').replace('win32', 'windows');

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

  const finished = function (err, out) {
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
    if (!emitter) return;
    return emitter.emit('end', id, err, output);
  };

  token.post_token({ action: opts.target, token: opts.token, id: opts.messageID }, (err) => {
    if (err) {
      const error = err;
      error.code = 5;
      error.name = errorFactoryReset.find((x) => x.code === error.code).message;
      return cb(error);
    }

    const data = {
      key: 'device-key',
      token: 'token',
      logged: false,
      dirs: [file_factory_reset, time_execution(), process.arch, file_factory_reset_xml],
    };

    action = 'factory-reset';

    emitter = new Emitter();
    cb(null, emitter);

    fs.writeFile(file_factory_reset_xml, factory_reset_options.format_file, (errWriteFile) => {
      if (errWriteFile) {
        const errWrite = errWriteFile;
        errWrite.code = 6;
        return cb(errWrite);
      }
      system.spawn_as_admin_user(node_bin, data, (errSpawn, child) => {
        if (errSpawn) {
          const errSpawnData = errSpawn;
          errSpawnData.code = 7;
          logger.info(`Error executing Factory Reset :${JSON.stringify(errSpawnData)}`);
          return cb(errSpawn);
        }
        if (typeof child === 'function') { // only for windows
          child(action, data, finished);
        } else {
          const error = new Error('Admin service not available');
          error.code = 4;
          error.name = errorFactoryReset.find((x) => x.code === error.code).message;
          return cb(error);
        }
      });
    });
  });
};

exports.stop = function () {
  emitter = null;
};
