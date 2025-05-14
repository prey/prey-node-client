/* eslint-disable consistent-return */
const fs = require('fs');
const os = require('os');
const { join } = require('path');
const async = require('async');
const archiver = require('archiver');
const needle = require('needle');
const Emitter = require('events').EventEmitter;
const common = require('../../common');

const logger = common.logger.prefix('logretrieval');
const { paths } = common.system;
const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const keys = require('../../control-panel/api/keys');

const utilStorage = require('../../utils/storage/utilstorage');
const database = require('../../utils/storage/database');

exports.tmpdir = osName === 'windows' ? `${process.env.WINDIR}\\Temp` : '/tmp';

const config = require('../../../utils/configfile');

const protocol = config.getData('control-panel.protocol');
const host = config.getData('control-panel.host');
const url = `${protocol}://${host}`;

const UPLOAD_URL = `${url}/upload/log`;
const OPEN_TIMEOUT = 180000;
const READ_TIMEOUT = 2000;

let em;
let cp;
let LOG_PATH;
let FENIX_LOG_PATH;
let CONF_PATH;
let ROTATED_PATH;
let WINSVC_LOG;
let WINSVC_UPDATER;
let LOGS_ZIP_PATH;
let wifiDataPath;
let hardwareDataPath;
const CONFIG_PATH = paths.config;
const COMMANDS_PATH = join(CONFIG_PATH, 'commands.db');
const commandsJsonPath = join(exports.tmpdir, 'commands.json');

const isObjectEmpty = (obj) => obj && typeof obj === 'object' && Object.keys(obj).length === 0;

exports.collectFiles = (outputFile, cb) => {
  const output = fs.createWriteStream(outputFile);
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  output.on('close', () => {
    const totalBytes = archive.pointer();
    return cb(null, totalBytes);
  });

  archive.on('error', cb);

  archive.pipe(output);

  const files = [
    { path: CONF_PATH, name: 'prey.conf' },
    { path: LOG_PATH, name: 'prey.log' },
    { path: wifiDataPath, name: 'wifi_data.json' },
    { path: hardwareDataPath, name: 'hardware_data.json' },
    { path: COMMANDS_PATH, name: 'commands.db' },
    { path: commandsJsonPath, name: 'commands.json' },
    { path: ROTATED_PATH, name: 'prey.log.1.gz' },
    ...(os.platform() === 'win32' ? [ // Only for windows add admin service logs
      { path: WINSVC_LOG, name: 'winsvc.log' },
      { path: FENIX_LOG_PATH, name: 'fenix.log' },
      { path: WINSVC_UPDATER, name: 'updater.log' },
    ] : []),
  ];

  const array = [];

  files.forEach((file) => {
    if (!fs.existsSync(file.path)) {
      return;
    }
    array.push((callback) => {
      let fileData;
      const rs = fs.createReadStream(file.path);
      rs.on('error', () => {
        callback();
      });

      rs.on('data', (data) => {
        if (fileData) fileData = fileData.toString().concat(data);
        else fileData = data;
      });

      rs.on('close', () => {
        archive.append(fileData, { name: file.name });
        callback();
      });
    });
  });

  async.series(array, () => {
    archive.finalize();
  });
};

const getFile = (filePath, fileSize, cb) => {
  const buf = Buffer.alloc(fileSize);
  const fd = fs.openSync(filePath, 'r');

  // eslint-disable-next-line consistent-return
  fs.read(fd, buf, 0, fileSize, 0, (err, read, buffer) => {
    if (err) return cb(err);
    cb(null, buffer);
  });
};

exports.upload_zip = (filePath, bytes, cb) => {
  // eslint-disable-next-line consistent-return
  getFile(filePath, bytes, (err, buf) => {
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

    // eslint-disable-next-line consistent-return
    needle.post(`${UPLOAD_URL}?deviceKey=${devicekey}`, buf, options, (errPost, res) => {
      if (errPost) return cb(errPost);

      const out = res.statusCode;

      if (out !== 200 && out !== 201) { return cb(new Error('There was an error uploading logs file')); }

      logger.info('Log file succesfuly uploaded!');
      cb(null);
    });
  });
};

exports.done = (id, err) => {
  if (err) logger.info(err);
  em.emit('end', id, err);
};

const promises = [
  new Promise((resolve) => {
    try {
      utilStorage.getDataDbKey('hardware_changed', (_errorDataHardware, txtHardware) => {
        try {
          let jsonHardwareInformation = '';
          if (txtHardware !== '') {
            if (typeof txtHardware === 'string') jsonHardwareInformation = txtHardware;
            else jsonHardwareInformation = txtHardware[0].value;
          }
          resolve(jsonHardwareInformation);
        } catch (error) {
          logger.info(`There was an error getting hardware data: ${error}`);
          resolve('');
        }
      });
    } catch (error) {
      logger.info(`There was an error getting hardware data: ${error}`);
      resolve('');
    }
  }),
  new Promise((resolve) => {
    try {
      utilStorage.getDataDbKey('wifiDataStored', (_errorDataWifi, txt) => {
        try {
          let jsonInformation = '';
          if (txt !== '') {
            if (typeof txtHardware === 'string') jsonInformation = txt;
            else jsonInformation = txt[0].value;
          }
          resolve(jsonInformation);
        } catch (error) {
          logger.info(`There was an error getting wifi data: ${error}`);
          resolve('');
        }
      });
    } catch (error) {
      logger.info(`There was an error getting wifi data: ${error}`);
      resolve('');
    }
  }),
  new Promise((resolve) => {
    (async () => {
      try {
        const jsonDb = await database.dbToJson(COMMANDS_PATH, commandsJsonPath);
        if (jsonDb instanceof Error) resolve(`Error creating json from commands.db: ${jsonDb}`);
        if (!isObjectEmpty(jsonDb)) {
          fs.writeFileSync(commandsJsonPath, JSON.stringify(jsonDb, null, 2), { flag: 'w+' });
          resolve();
        } else if (jsonDb instanceof Error) {
          logger.info(`Error creating json from commands.db: ${jsonDb}`);
          resolve(jsonDb);
        }
      } catch (error) {
        resolve(error);
      }
    })();
  }),
];

exports.start = (id, options, cb) => {
  LOG_PATH = paths.log_file;
  FENIX_LOG_PATH = join(CONFIG_PATH, 'fenix.log');
  CONF_PATH = join(CONFIG_PATH, 'prey.conf');
  ROTATED_PATH = join(CONFIG_PATH, 'prey.log.1.gz');
  WINSVC_LOG = join(CONFIG_PATH, 'winsvc.log');
  WINSVC_UPDATER = join(CONFIG_PATH, 'updater.log');
  LOGS_ZIP_PATH = join(exports.tmpdir, 'logs.zip');
  wifiDataPath = join(exports.tmpdir, 'wifi_data.json');
  hardwareDataPath = join(exports.tmpdir, 'hardware_data.json');
  Promise.all(promises).then((results) => {
    const [hardwareData, wifiData, jsonDbErr] = results;
    // Ahora puedes utilizar ambos datos para coleccionar los archivos
    fs.writeFile(hardwareDataPath, hardwareData, { flag: 'w+' }, (error) => {
      if (error) logger.info(`Error writing hardware data: ${error}`);
      fs.writeFile(wifiDataPath, wifiData, { flag: 'w+' }, (errorWrite) => {
        if (errorWrite) logger.info(`Error writing wifi data: ${errorWrite}`);
        exports.collectFiles(LOGS_ZIP_PATH, (err, bytes) => {
          if (err) return exports.done(id, err);
          if (jsonDbErr) logger.info(`Error creating json from commands.db: ${jsonDbErr}`);
          exports.upload_zip(LOGS_ZIP_PATH, bytes, (errUpload) => exports.done(id, errUpload));
        });

        em = em || new Emitter();
        if (cb) cb(null, em);
      });
    });
  });
};

exports.stop = () => {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
};
