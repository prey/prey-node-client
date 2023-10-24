const fs = require('fs');
const path = require('path');
const Emitter = require('events').EventEmitter;
const wipe = require('./wipe');
const common = require('../../common');

const gte = common.helpers.is_greater_or_equal;
const keys = require('../../plugins/control-panel/api/keys');

const { join } = path;
// eslint-disable-next-line camelcase
const { os_name } = common;
// eslint-disable-next-line import/no-dynamic-require, camelcase
const osWipe = require(`./${os_name}`);

const logger = common.logger.prefix('wipe');
const { system } = common;
const customDirs = require('../../utils/custom-dirs');

let lastErr;
let directories = [];
let cloud = [];
let emitter;
let wipeProcess; // for storing child instance

exports.node_bin = join(system.paths.current, 'bin', 'node');

if (common.os_name === 'windows') exports.node_bin += '.exe';
/**
 * Validates a list of directories.
 *
 * @param {Array} dirs - The list of directories to be validated.
 * @return {boolean} Returns true if all directories are valid, false otherwise.
 */
const validDirs = (dirs) => {
  const validated = customDirs.validateCustomDirs(dirs, false);
  if (!validated) return false;
  let dirValidated;
  [dirValidated, cloud] = validated;

  cloud = customDirs.get_tasks(cloud);
  directories = customDirs.collect_wipe_paths(cloud).concat(dirValidated.split(','));
  return !(directories.length === 0);
};
/**
 * Generates a list of valid types based on the given hash object.
 *
 * @param {Object} hash - The hash object containing the types to be validated.
 * @return {Array} The list of valid types.
 */
const validTypes = (hash) => {
  const list = [];

  // hash keys should be 'wipe_cookies', 'wipe_passwords', etc

  logger.info('typeof hash');
  logger.info(JSON.stringify(hash));
  logger.info(typeof hash);
  const keysHash = Object.keys((hash));
  if (!Array.isArray(keysHash)) return list;
  keysHash.forEach((key) => {
    const val = hash[key].toString().trim();
    if ((val !== 'false' && val !== 'off' && key.includes('wipe_')) && (val === 'on' || val === 'true' || validDirs(val))) {
      const method = key.replace('wipe_', ''); // just 'cookies'
      if (typeof wipe[method] === 'function') list.push(method);
    }
  });

  return list;
};
/**
 * Starts the wiping process.
 *
 * @param {string} id - The ID of the process.
 * @param {Object} options - The options for the wiping process.
 * @param {string} options.token - The token for authentication.
 * @param {Function} cb - The callback function.
 * @return {void}
 */
// eslint-disable-next-line consistent-return
exports.start = (id, options, cb) => {
  const opts = options || {};
  const token = opts.token || null;
  // const confirm = opts.confirm === 'ireallyknowwhatiamdoing';
  const items = validTypes(opts);

  // if (!confirm)
  //   return cb(new Error('Invalid confirmation string.'))

  if (items.length === 0) { return cb(new Error('Nothing to wipe!')); }

  logger.warn(`WIPING ${items.join(', ')}`);

  let queued = 0;
  let removed = 0;
  const finished = (err, service) => {
    logger.warn(`Error when removing files: ${err}`);
    logger.warn(`Process finished! ${service ? '' : `${removed} dir(s) removed.`}`);

    if (!emitter) return;
    // eslint-disable-next-line consistent-return
    if (service) return emitter.emit('end', id, err);

    // if no files were removed, treat that as an error
    if (!err && removed === 0) {
      emitter.emit('end', id, new Error('No dirs were removed.'));
    } else {
      emitter.emit('end', id, err, { files_removed: removed });
    }
  };
  // runs it within this context, unlike the spawn option
  // eslint-disable-next-line consistent-return
  const queue = (error, method) => {
    queued += 1;
    if (typeof wipe[method] === 'function') {
      wipe[method]((err, removedItems) => {
        if (err) lastErr = err;

        removed += removedItems;
        queued -= 1;
        if (!queued) finished(id, lastErr);
      });
    } else return finished(id, error);
  };

  const compareWinsvcVersion = (callback) => {
    // eslint-disable-next-line global-require
    const sysWin = require('../../../system/windows');
    // eslint-disable-next-line consistent-return
    sysWin.get_winsvc_version((err, serviceVersion) => {
      if (err) return callback(false);

      if (serviceVersion && gte(serviceVersion, '2.0.3')) return callback(true);
      callback(false);
    });
  };

  // run it as another process, using impersonation (to avoid permission errors)
  const spawn = () => {
    const wipeOpts = [
      '-token', opts.token,
      cloud.toString(),
      directories.toString(),
    ];

    wipe.wipeConfiguration(opts.fill_only, opts.keep_root, opts.three_pass);

    const args = [join(__dirname, 'runner.js')].concat(items).concat(wipeOpts);
    // eslint-disable-next-line consistent-return
    system.spawn_as_admin_user(exports.node_bin, args, (err, child) => {
      if (err) {
        // eslint-disable-next-line camelcase
        if (err.toString().includes('No logged user') && os_name === 'windows') {
          logger.warn('Not logged user found, proceding without impersonation');
          return queue(err, items);
        } return finished(id, err);
      }

      if (typeof child === 'function') { // only for windows
        osWipe.paths.directories = directories;

        logger.info(`${osWipe.paths.directories}`);
        wipe.fetch_dirs(items, directories, cloud, ['-token', token], (_err, dirs) => {
          compareWinsvcVersion((newer) => {
            const optsData = {
              dirs: dirs.dirsToWipe.concat(dirs.dirsToWipeKeep),
              token,
              key: keys.get().device.toString(),
            };

            if (newer) {
              optsData.dirs = dirs.dirsToWipe;
              optsData.dir_keep = dirs.dirsToWipeKeep;
            }
            child('wipe', optsData, (errChild) => {
              if (errChild) lastErr = new Error('Wipe command failed through service');
              finished(id, lastErr);
            });
          });
        });
      } else {
        child.stdout.on('data', (str) => {
          const lines = str.toString().split(/\n/);
          lines.forEach((line) => {
            if (line.toString().match('Removing directory')) {
              logger.warn(line.trim());
              removed += 1;
            } else if (line.toString().match('Error while removing dir')) {
              logger.warn(line.trim());
            } else if (line.trim() !== '') {
              logger.debug(line.trim());
            }
          });
        });

        child.on('exit', (code) => {
          if (code !== 0) { lastErr = new Error('Wipe command failed.'); }

          finished(id, lastErr);
        });

        wipeProcess = child;
      }
    });
  };

  emitter = new Emitter();
  cb(null, emitter);
  if (fs.existsSync(exports.node_bin)) spawn();
  else finished(id, new Error('Node binary not present'));
};
/**
 * Stops the execution of the function.
 *
 * @return {void}
 */
exports.stop = () => {
  if (wipeProcess) wipeProcess.kill();

  emitter = null;
};

exports.validTypes = validTypes;
exports.directories = directories;
exports.cloud = cloud;
