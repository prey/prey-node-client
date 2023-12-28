/// ///////////////////////////////////////
// Prey JS LogRetrieval
// (C) 2019 Prey, Inc.
// by Javier Acuña - http://preyproject.com
// GPLv3 Licensed
/// ///////////////////////////////////////

const fs = require('fs');
const os = require('os');
const { join } = require('path');
const async = require('async');
const archiver = require('archiver');
const needle = require('needle');
const Emitter = require('events').EventEmitter;
const common = require('../../../common');

const logger = common.logger.prefix('logretrieval');
const { paths } = common.system;
const os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const keys = require('../../control-panel/api/keys');

exports.tmpdir = os_name == 'windows' ? `${process.env.WINDIR}\\Temp` : '/tmp';

const config = require('../../../utils/configfile');

const protocol = config.get('control-panel.protocol');
const host = config.get('control-panel.host');
const url = `${protocol}://${host}`;

const UPLOAD_URL = `${url}/upload/log`;
const OPEN_TIMEOUT = 180000;
const READ_TIMEOUT = 2000;

let em; let
  cp;

let CONFIG_PATH;
let LOG_PATH;
let COMMANDS_PATH;
let CONF_PATH;
let ROTATED_PATH;
let WINSVC_LOG;
let WINSVC_UPDATER;
let LOGS_ZIP_PATH;

const collect_files = (output_file, cb) => {
  const output = fs.createWriteStream(output_file);
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  output.on('close', () => {
    const total_bytes = archive.pointer();
    return cb(null, total_bytes);
  });

  archive.on('error', cb);

  archive.pipe(output);

  const files = [
    { path: CONF_PATH, name: 'prey.conf' },
    { path: LOG_PATH, name: 'prey.log' },
    { path: COMMANDS_PATH, name: 'commands.db' },
    { path: ROTATED_PATH, name: 'prey.log.1.gz' },
    ...(os.platform() == 'win32' ? [ // Only for windows add admin service logs
      { path: WINSVC_LOG, name: 'winsvc.log' },
      { path: WINSVC_UPDATER, name: 'updater.log' },
    ] : []),
  ];

  const array = [];

  files.forEach((file) => {
    if (!fs.existsSync(file.path)) {
      return;
    }
    array.push((callback) => {
      let file_data;
      const rs = fs.createReadStream(file.path);
      rs.on('error', (err) => {
        callback();
      });

      rs.on('data', (data) => {
        if (file_data) file_data = file_data.toString().concat(data);
        else file_data = data;
      });

      rs.on('close', () => {
        archive.append(file_data, { name: file.name });
        callback();
      });
    });
  });

  async.series(array, (err) => {
    archive.finalize();
  });
};

const get_file = (file_path, file_size, cb) => {
  const buf = Buffer.alloc(file_size);
  const fd = fs.openSync(file_path, 'r');

  fs.read(fd, buf, 0, file_size, 0, (err, read, buf) => {
    if (err) return cb(err);
    cb(null, buf);
  });
};

exports.upload_zip = (file_path, bytes, cb) => {
  get_file(file_path, bytes, (err, buf) => {
    if (err) return cb(err);

    const apikey = keys.get().api;
    const devicekey = keys.get().device;

    const options = {
      user_agent: common.system.user_agent,
      open_timeout: OPEN_TIMEOUT,
      read_timeout: READ_TIMEOUT,
      username: apikey,
      password: 'x',
    };

    needle.post(`${UPLOAD_URL}?deviceKey=${devicekey}`, buf, options, (err, res) => {
      if (err) return cb(err);

      const out = res.statusCode;

      if (out !== 200 && out !== 201) { return cb(new Error('There was an error uploading logs file')); }

      logger.info('Log file succesfuly uploaded!');
      cb(null);
    });
  });
};

const done = (id, err) => {
  if (err) logger.info(err);
  em.emit('end', id, err);
};

exports.start = function (id, options, cb) {
  CONFIG_PATH = paths.config;
  LOG_PATH = paths.log_file;
  COMMANDS_PATH = join(CONFIG_PATH, 'commands.db');
  CONF_PATH = join(CONFIG_PATH, 'prey.conf');
  ROTATED_PATH = join(CONFIG_PATH, 'prey.log.1.gz');
  WINSVC_LOG = join(CONFIG_PATH, 'winsvc.log');
  WINSVC_UPDATER = join(CONFIG_PATH, 'updater.log');
  LOGS_ZIP_PATH = join(exports.tmpdir, 'logs.zip');

  collect_files(LOGS_ZIP_PATH, (err, bytes) => {
    if (err) return done(id, err);

    exports.upload_zip(LOGS_ZIP_PATH, bytes, (err) => done(id, err));
  });

  em = em || new Emitter();
  if (cb) cb(null, em);
};

exports.stop = function () {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
};
