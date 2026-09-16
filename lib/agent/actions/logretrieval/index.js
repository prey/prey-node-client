// @ts-check
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
// Overall guard so start() always ends up emitting 'end', even if an unforeseen
// async step never calls back. Must exceed the upload open timeout.
const SAFETY_TIMEOUT = OPEN_TIMEOUT + 60000;

let cp;
// Per-call lifecycle state keyed by the action id, so overlapping start() calls
// never clobber each other's emitter / finished flag / safety timeout.
/**
 * @type {Map<string, {
 *   emitter: import('events').EventEmitter, finished: boolean, safetyTimeout: any
 * }>}
 */
const activeCalls = new Map();
let LOG_PATH;
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
      { path: paths.program_data, name: 'fenix.log' },
      { path: WINSVC_UPDATER, name: 'updater.log' },
    ] : []),
  ];

  const array = [];

  files.forEach((file) => {
    if (!fs.existsSync(file.path)) {
      return;
    }
    array.push((callback) => {
      let fileData = '';
      let hasError = false;
      const rs = fs.createReadStream(file.path);

      rs.on('error', (error) => {
        hasError = true;
        logger.info(`There was an error reading file ${file.name}: ${error}`);
        rs.destroy();
        callback();
      });

      rs.on('data', (data) => {
        if (hasError) return;
        try {
          if (!data) logger.info(`There was an error reading file ${file.name}: no data`);
          if (fileData) fileData = fileData.toString().concat(data.toString());
          else fileData = data.toString();
        } catch (error) {
          logger.info(`There was an error reading file ${file.name}: ${error}`);
        }
      });

      rs.on('close', () => {
        if (hasError) return;
        try {
          archive.append(fileData || '', { name: file.name });
        } catch (error) {
          logger.info(`There was an error appending file ${file.name} to archive: ${error}`);
        }
        // Always advance the series so archive.finalize() is reached even when
        // a single file fails to append; otherwise collectFiles would hang.
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

/**
 * Emit the 'end' event exactly once for the given call, closing its lifecycle.
 * Idempotent per id: once a call has finished its entry is removed, so further
 * calls are no-ops and the emitter never fires twice.
 * @param {string} id
 * @param {Error|null} [err]
 */
exports.done = (id, err) => {
  const call = activeCalls.get(id);
  if (!call || call.finished) return;
  call.finished = true;
  if (call.safetyTimeout) {
    clearTimeout(call.safetyTimeout);
    call.safetyTimeout = null;
  }
  activeCalls.delete(id);
  if (err) logger.info(err);
  if (call.emitter) call.emitter.emit('end', id, err);
};

const createPromises = () => [
  new Promise((resolve) => {
    try {
      utilStorage.getDataDbKey('hardware_changed', (_errorDataHardware, txtHardware) => {
        try {
          let jsonHardwareInformation = '';
          if (txtHardware) {
            if (typeof txtHardware === 'string') jsonHardwareInformation = txtHardware;
            else if (Array.isArray(txtHardware) && txtHardware.length > 0) {
              jsonHardwareInformation = txtHardware[0].value;
            }
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
          if (txt) {
            if (typeof txt === 'string') jsonInformation = txt;
            else if (Array.isArray(txt) && txt.length > 0) jsonInformation = txt[0].value;
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
  new Promise((/** @type {(value?: any) => void} */ resolve) => {
    (async () => {
      try {
        const db = /** @type {any} */ (database);
        const jsonDb = await db.dbToJson(COMMANDS_PATH, commandsJsonPath);
        if (jsonDb instanceof Error) {
          logger.info(`Error creating json from commands.db: ${jsonDb}`);
          resolve(jsonDb);
          return;
        }
        if (!isObjectEmpty(jsonDb)) {
          fs.writeFileSync(commandsJsonPath, JSON.stringify(jsonDb, null, 2), { flag: 'w+' });
        }
        // Always resolve, even when jsonDb is empty, so Promise.all never hangs.
        resolve();
      } catch (error) {
        resolve(error);
      }
    })();
  }),
];

/**
 * Collect logs/config, zip them and upload to the panel.
 * Guarantees the returned emitter emits 'end' exactly once (success, error or
 * timeout), so the action lifecycle always closes and its target lock is freed.
 * @param {string} id
 * @param {Object} options
 * @param {Function} [cb]
 */
exports.start = (id, options, cb) => {
  const emitter = new Emitter();
  const call = { emitter, finished: false, safetyTimeout: null };
  activeCalls.set(id, call);

  // Deliver the emitter up front so actions.js registers its 'end' listener
  // before any async work runs. This lets the safety timeout below release the
  // lifecycle even if the chain hangs before reaching the normal cb site.
  let cbCalled = false;
  const ensureCb = () => {
    if (cbCalled) return;
    cbCalled = true;
    if (typeof cb === 'function') cb(null, emitter);
  };

  // fs.writeFile callbacks run on a later libuv tick, outside the promise chain,
  // so a synchronous throw there would escape .catch() and crash the agent via
  // the global uncaughtException handler. Route any such throw to done() instead.
  const guard = (fn) => (...args) => {
    try {
      return fn(...args);
    } catch (e) {
      ensureCb();
      return exports.done(id, e instanceof Error ? e : new Error(String(e)));
    }
  };

  call.safetyTimeout = setTimeout(() => {
    ensureCb();
    exports.done(id, new Error('logretrieval timed out'));
  }, SAFETY_TIMEOUT);
  if (call.safetyTimeout && typeof call.safetyTimeout.unref === 'function') call.safetyTimeout.unref();

  LOG_PATH = paths.log_file;
  CONF_PATH = join(CONFIG_PATH, 'prey.conf');
  ROTATED_PATH = join(CONFIG_PATH, 'prey.log.1.gz');
  WINSVC_LOG = join(CONFIG_PATH, 'winsvc.log');
  WINSVC_UPDATER = join(CONFIG_PATH, 'updater.log');
  LOGS_ZIP_PATH = join(exports.tmpdir, 'logs.zip');
  wifiDataPath = join(exports.tmpdir, 'wifi_data.json');
  hardwareDataPath = join(exports.tmpdir, 'hardware_data.json');
  Promise.all(createPromises())
    .then((results) => {
      const [hardwareData, wifiData, jsonDbErr] = results;
      // Both data files are ready; write them out and collect the archive.
      fs.writeFile(hardwareDataPath, hardwareData, { flag: 'w+' }, guard((error) => {
        if (error) logger.info(`Error writing hardware data: ${error}`);
        fs.writeFile(wifiDataPath, wifiData, { flag: 'w+' }, guard((errorWrite) => {
          if (errorWrite) logger.info(`Error writing wifi data: ${errorWrite}`);
          exports.collectFiles(LOGS_ZIP_PATH, guard((err, bytes) => {
            if (err) return exports.done(id, err);
            if (jsonDbErr) logger.info(`Error creating json from commands.db: ${jsonDbErr}`);
            return exports.upload_zip(LOGS_ZIP_PATH, bytes, (errUpload) => {
              exports.done(id, errUpload);
            });
          }));

          ensureCb();
        }));
      }));
    })
    .catch((err) => {
      ensureCb();
      exports.done(id, err instanceof Error ? err : new Error(String(err)));
    });
};

exports.stop = () => {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
};
