/// ///////////////////////////////////////
// Prey JS FileRetrieval
// (C) 2019 Prey, Inc.
// by Mauricio Schneider and Javier Acuña - http://preyproject.com
// GPLv3 Licensed
/// ///////////////////////////////////////

const fs = require('fs');
const path = require('path');
const needle = require('needle');
const { v4: uuidv4 } = require('uuid');
const common = require('../../common');
const storage = require('../../utils/storage');
const Emitter = require('events').EventEmitter;

const { system } = common;
const { run_as_user } = common.system;
const node_bin = path.join(system.paths.current, 'bin', 'node');
const os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
const { logger } = common;

const config = require('../../../utils/configfile');

const protocol = config.getData('control-panel.protocol');
const host = config.getData('control-panel.host');
const url = `${protocol}://${host}`;

const UPLOAD_SERVER = `${url}/upload/upload`;

let em;
let cp;

let path_arg;
let name_arg;

// check_pending_files is used to resume any files that might been pending. It's called from
// filesagent/providers/network.

const run_stored = (host, cb) => {
  if (host != 'solid.preyproject.com') return;

  storage.do('all', { type: 'files' }, (err, files) => {
    if (err || !files) return cb(new Error('Error retrieving file from local database'));

    const count = Object.keys(files).length;
    if (count <= 0) { return; }
    logger.warn(`Re-uploading ${count} pending files.`);

    files.forEach((file) => {
      const opts = {
        path: file.path,
        user: file.user,
        name: file.name,
        size: file.size,
        file_id: file.id,
        attempts: file.attempts,
        resumable: file.resumable,
      };
      const id = uuidv4();
      exports.start(id, opts, cb);
    });
  });
};

const retrieve_file_as_user = function (options, cb) {
  if (os_name == 'windows') {
    path_arg = path.resolve(options.path);
    name_arg = path.resolve(options.name);
  } else {
    path_arg = `"${options.path}"`;
    name_arg = `"${options.name}"`;
  }
  const opts = {
    user: options.user,
    bin: node_bin,
    type: 'exec',
    args: [path.join(__dirname, 'upload.js'), path_arg, options.user, name_arg, options.size, options.file_id, options.total, options.port],
    opts: {
      env: process.env,
    },
  };

  run_as_user(opts, (err, out) => {
    if (err) {
      logger.error(`Upload error: ${err.message}`);
      return;
    }
    logger.info(`Ran as user: ${out}`);
    if (out.indexOf('File succesfuly uploaded') != -1) {
      logger.debug(`Removing file_id from DB: ${options.file_id}`);
      storage.do('del', { type: 'files', id: options.file_id });
      return;
    }
    if (out.includes('EPIPE') || out.includes('EACCES')) {
      const resumable_value = options.resumable == 1 ? 0 : 1;
      storage.do('update', {
        type: 'files', id: file_id, columns: 'resumable', values: resumable_value,
      }, (err) => { // resumable
        if (err) logger.error('Database update error');
        logger.info(`Resume file option activated for ID: ${options.file_id}`);
      });
    }
  });
};

exports.check_pending_files = function () {
  run_stored(host, (err) => {
    if (err) logger.error(err.message);
  });
};

exports.start = function (id, options, cb) {
  const url = `${UPLOAD_SERVER}?uploadID=${options.file_id}`;
  // Make a call to get the last byte processed by the upload server
  // in order to resume the upload from that position.
  needle.request('get', url, null, (err, res) => {
    if (err) {
      console.log(err);
      return;
    }
    if (res.statusCode == 404) {
      logger.debug(`Removing file_id from DB: ${options.file_id}`);
      storage.do('del', { type: 'files', id: options.file_id });
      return;
    }
    const data = JSON.parse(res.body);
    const file_status = JSON.parse(res.body).Status;
    options.total = data.Total;

    if (file_status == 0 || file_status == 4) { // File in progress(0) or Pending(4)
      storage.do('query', { type: 'files', column: 'id', data: options.file_id }, (err, files) => {
        if (files && files.length == 0) {
          options.resumable = 0;
          options.total = 0;

          const data = {
            name: options.name,
            path: options.path,
            size: options.size,
            user: options.user,
            attempts: 0,
            resumable: options.resumable,
          };

          logger.debug(`Storing file_id in DB: ${options.file_id}`);
          storage.do('set', { type: 'files', id: options.file_id, data }, () => {
            retrieve_file_as_user(options);
          });
        } else {
          setTimeout(() => {
            const file_attempts = files[0].attempts;
            if (file_attempts >= 3) {
              logger.info(`File ${options.file_id}has no more attempts, deleting...`);
              return;
            }

            if (options.resumable == 1) {
              storage.do('update', {
                type: 'files', id: file_id, columns: ['attempts', 'resumable'], values: [file_attempts + 1, 0],
              }, (err) => { // resumable
                if (err) logger.error('Database update error');
                logger.info(`Resume file option deactivated for ID: ${options.file_id}`);
                retrieve_file_as_user(options);
              });
            }
          }, 2000);
        }
      });
    } else {
      if (file_status == 1) { logger.debug('File already uploaded, deleting from db...'); } else { logger.debug('File cancelled or with an error, deleting from db...'); }

      logger.info(`Removing file_id from DB: ${options.file_id}`);
      storage.do('del', { type: 'files', id: options.file_id });
    }
  });

  em = em || new Emitter();

  if (cb) cb(null, em);
  em.emit('end', id);
};

exports.stop = function () {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
};
