const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const { createHash } = require('crypto');
const needle = require('needle');
const rmdir = require('rimraf');
const whenever = require('whenever');
const remove = require('remover');
const arch = require('arch')();
const storage = require('./agent/utils/storage');
const { isGreaterThan } = require('./agent/helpers');
const paths = require('./system/paths');
const system = require('./system');
const common = require('./common');
const shared = require('./conf/shared');
const install = require('./conf/install');
const location = require('./agent/triggers/location');
const geo = require('./agent/providers/geo');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const tmpdir = osName === 'windows' ? `${process.env.WINDIR}\\Temp` : '/tmp';

const delayed = whenever('buckle');

const npmPackageControllerUrl = 'https://registry.npmjs.org/prey';
const releasesHost = 'https://downloads.preyproject.com';
const releasesUrl = `${releasesHost}/prey-client-releases/node-client/`;
const latestText = 'latest.txt';
const checksums = 'shasums.json';
const packageControllerFormat = '.zip';

const MAX_UPDATE_ATTEMPS = 60;
let ongoingAttempt = 1;

/// //////////////////////////////////////////////////////
// helpers
/**
 * Logs a string to the console.
 *
 * @param {string} str - The string to be logged.
 * @return {undefined} Returns undefined.
 */
const log = (str) => {
  if (process.stdout.writable) process.stdout.write(`${str}\n`);
};

/**
 * Calculates the checksum for a given file using the SHA1 algorithm.
 *
 * @param {string} file - The path to the file.
 * @param {function} cb - The callback function to be called when the checksum is calculated.
 *        The callback function should have the signature (error, checksum).
 *        If an error occurs during the calculation, the error parameter will be populated.
 *        Otherwise, the checksum parameter will contain the calculated checksum in
 *        hexadecimal format.
 * @return {void}
 */
const checksumFor = (file, cb) => {
  const hash = createHash('sha1');
  const stream = fs.createReadStream(file);

  stream.on('data', (chunk) => {
    hash.update(chunk);
  });

  stream.on('error', (errorRead) => {
    cb(errorRead);
  });

  stream.on('end', () => {
    cb(null, hash.digest('hex'));
  });
};
/**
 * Unpacks a zip file to a destination directory.
 *
 * @param {string} zip - The path to the zip file.
 * @param {string} dest - The path to the destination directory.
 * @param {function} cb - The callback function to be called after the unpacking is complete.
 * @return {void}
 */
// eslint-disable-next-line consistent-return
const unpack = (zip, dest, cb) => {
  if (process.platform !== 'darwin') return delayed.buckle.open(zip, dest, cb);

  // on OSX, we'll use ditto to ensure extended attributes are kept
  const cmd = `ditto -xk ${zip} ${dest}`;

  // increase maxBuffer to avoid [stderr maxBuffer exceeded]
  cp.exec(cmd, { maxBuffer: 1024 * 1024 * 64 }, cb);
};
/**
 * Moves a directory from one location to another with retry logic.
 *
 * @param {string} from - The current location of the directory.
 * @param {string} to - The destination location for the directory.
 * @param {number} attempt - The current attempt number.
 * @param {function} cb - The callback function to call when the operation is
 *        complete or an error occurs.
 * @return {void}
 */
// on windows, antivirus softwares lock new folders until all files are scanned
// which causes a EPERM error when doing a fs.rename. to prevent this from ruining
// the process, we'll retry the fs.rename 10 times every one second if we do get a EPERM error.
const likeABoss = (from, to, attempt, cb) => {
  fs.rename(from, to, (error) => {
    if (error) log(`Error when moving directory: ${error.message}`);
    // if no error, or err is not EPERM/EACCES, we're done
    if (!error || (error.code !== 'EPERM' && error.code !== 'EACCES')) cb();
    // max attempts reached, so give up.
    else if (attempt >= 30) cb(error);
    else setTimeout(() => likeABoss(from, to, attempt + 1, cb), 1000);
  });
};
/**
 * Moves a file from one location to another.
 *
 * @param {string} from - The source path of the file.
 * @param {string} to - The destination path of the file.
 * @param {function} cb - A callback function to be executed after the file has been moved.
 * @return {void} This function does not return a value.
 */
// eslint-disable-next-line consistent-return
const move = (from, to, cb) => {
  if (process.platform !== 'win32') return fs.rename(from, to, cb);
  likeABoss(from, to, 1, cb);
};

const packageController = {};
/**
 * Sends an update event to the server.
 *
 * @param {string} type - The type of the update event.
 * @param {string} status - The status of the update event.
 * @param {string} oldVersion - The old version of the software.
 * @param {string} newVersion - The new version of the software.
 * @param {number} attempt - The number of attempts made to update.
 * @param {Error} error - Any error that occurred during the update.
 * @param {function} cb - The callback function to be called after the update event is sent.
 * @return {void}
 */
const sendUpdateEvent = (type, status, oldVersion, newVersion, attempt, error, cb) => {
  // eslint-disable-next-line consistent-return
  shared.keys.verify_current((errVerifyKeys) => {
    if (errVerifyKeys) return cb(errVerifyKeys);

    // Get the local IP, the country and location
    packageController.get_update_data((res) => {
      const data = {
        name: 'client_install',
        info: {
          type,
          status,
          old_ver: oldVersion,
          new_ver: newVersion,
          attempt,
          error,
          location: res.location,
          ip: res.public_ip,
          country: res.country,
          arch,
          os: osName,
          key: common.config.get('control-panel.device_key').toString() || null,
        },
      };
      packageController.post_event(data, cb);
    });
  });
};
/**
 * Retrieves the stable version from the server.
 *
 * @param {function} cb - The callback function to handle the retrieved version.
 * @return {undefined} The function does not return a value directly. The retrieved
 * version is passed to the callback function.
 */
const getStableVersion = (cb) => {
  const key = common.config.get('control-panel.device_key').toString() || null;
  const options = {
    headers: { 'resource-dk': key },
  };
  needle.get(releasesUrl + latestText, key ? options : null, (err, resp, body) => {
    const ver = body && body.toString().trim();
    // log('Latest upstream version: ' + ver);
    cb(err, ver);
  });
};
/**
 * Retrieves the latest version of the Edge package from the npm package controller.
 *
 * @param {function} cb - The callback function to be executed upon completion.
 * @return {undefined} No return value.
 */
const getEdgeVersion = (cb) => {
  // eslint-disable-next-line consistent-return
  needle.get(npmPackageControllerUrl, { parse: true }, (err, resp, body) => {
    if (err) return cb(err);
    const version = body['dist-tags'] && body['dist-tags'].latest;
    if (version) return cb(null, version.toString().trim());
    cb(new Error('Unable to figure out latest edge version.'));
  });
};
/**
 * Downloads a file from the specified URL.
 *
 * @param {string} url - The URL of the file to be downloaded.
 * @param {function} cb - The callback function to be called upon completion.
 * @return {void} This function does not return anything.
 */
// eslint-disable-next-line consistent-return
const downloadFromURL = (url, cb) => {
  const file = path.join(tmpdir, path.basename(url));

  if (fs.existsSync(file)) {
    log('PackageController already downloaded, moving on...');
    return cb(null, file);
  }

  log(`Downloading packageController: ${url}`);

  needle.get(url, { output: file }, (err, resp, data) => {
    if (err || resp.statusCode !== 200) return cb && cb(err || new Error(`Unexpected response: \n\n${data.toString()}`));

    const exists = fs.existsSync(file);
    if (!exists) return cb && cb(new Error('File not found!'));

    log(`Got file: ${file}`);
    return cb && cb(null, file);
  });
};
/**
 * Verifies the checksum of a file.
 *
 * @param {number} version - The version of the file.
 * @param {string} filename - The name of the file.
 * @param {string} file - The content of the file.
 * @param {function} cb - The callback function.
 * @return {void}
 */
const verifyChecksum = (version, filename, file, cb) => {
  function parseSums(body) {
    if (typeof body === 'object') return body;

    let data = {};
    try { data = JSON.parse(body); } catch (e) { /* bummer */ }
    return data;
  }

  const url = `${releasesUrl}${version}/${checksums}`;
  log(`Fetching checksums: ${url}`);
  // eslint-disable-next-line consistent-return
  needle.get(url, { parse: true }, (err, resp) => {
    if (err) return cb(err);
    const checksum = parseSums(resp.body)[filename];
    if (!checksum) return cb(new Error(`Unable to retrieve checksum for ${filename}`));
    log(`Got checksum from remote: ${checksum}. Calculating file hash...`);
    checksumFor(file, (_errChecksumFor, res) => {
      const valid = (res && res.trim() === checksum.trim());
      cb(err, valid);
    });
  });
};
/**
 * Downloads a file with the specified version and architecture.
 *
 * @param {string} version - The version of the file to download.
 * @param {string} archFile - The architecture of the file to download.
 * @param {function} cb - A callback function to handle the downloaded file.
 * @return {void}
 */
const downloadFile = (version, archFile, cb) => {
  log(`Download file - version: ${version}/arch: ${archFile}`);
  const release = ['prey', osName, version, archFile].join('-') + packageControllerFormat;
  const url = `${releasesUrl}${version}/${release}`;
  // eslint-disable-next-line consistent-return
  downloadFromURL(url, (err, file) => {
    if (err) return cb(err);
    verifyChecksum(version, release, file, (errVerifyCheckSum, valid) => {
      if (errVerifyCheckSum || !valid) {
        return fs.unlink(file, () => cb && cb(errVerifyCheckSum || new Error(`Invalid checksum for file: ${release}`)));
      }
      log(`File checksum is valid! ${file}`);
      return cb && cb(null, file);
    });
  });
};
/**
 * Downloads and verifies a file based on the given version.
 *
 * @param {string} version - The version of the file to download and verify.
 * @param {function} cb - The callback function to be called after the download
 * and verification process.
 * @return {void} There is no return value.
 */
const downloadVerify = (version, cb) => {
  if (osName === 'mac') {
    cp.exec('sysctl sysctl.proc_translated', (err, stdout) => {
      if (err) downloadFile(version, arch, cb);
      else {
        const stdSlice = stdout.slice(stdout.length - 2, stdout.length - 1);
        downloadFile(version, stdSlice === '1' ? 'arm64' : arch, cb);
      }
    });
  } else downloadFile(version, arch, cb);
};

// ///////////////////////////////////////////////////////
// the packageController module
/**
 * Post an event to the package controller.
 *
 * @param {Object} data - The data to be posted.
 * @param {Function} cb - The callback function.
 * @return {undefined} No return value.
 */
packageController.postEvent = (data, cb) => {
  const urlTelemetry = 'https://solid.preyproject.com/api/v2/telemetry';

  const opts = {
    json: true,
    user_agent: system.user_agent,
  };
  needle.post(urlTelemetry, data, opts, (err) => cb && cb(err));
};
/**
 * Deletes the update attempts registry.
 *
 * @param {function} cb - The callback function to be called when the operation is complete.
 *                       It takes an error object as its only parameter.
 * @return {undefined} - This function does not return any value.
 */
packageController.deleteAttempts = (cb) => {
  storage.do('clear', { type: 'versions' }, (err) => {
    if (err) return cb(new Error(`Error deleting update attempts registry: ${err.message}`));
    return cb && cb(err);
  });
};
/**
 * Updates the version attempt in the package controller.
 *
 * @param {string} oldVersion - The old version of the package.
 * @param {string} newVersion - The new version of the package.
 * @param {boolean} attemptPlus - Whether to increment the attempt count.
 * @param {boolean} setNotified - Whether to set the notified flag.
 * @param {Error} error - An optional error object.
 * @param {function} cb - The callback function.
 * @return {undefined}
 */
// Update local update attemps db until the maximum number is reached,
// after that there's not gonna be
// more update attemps and the user is gonna be notified.
packageController.updateVersionAttempt = (
  oldVersion,
  newVersion,
  attemptPlus,
  setNotified,
  error,
  cb,
) => {
  const createVersion = (version) => {
    // Before creating the registry the table it's cleared
    // eslint-disable-next-line consistent-return
    storage.do('clear', { type: 'versions' }, (err) => {
      if (err) return cb(new Error('Unable to edit local database, update cancelled'));
      storage.do('set', {
        type: 'versions',
        id: version,
        data: {
          from: oldVersion,
          to: newVersion,
          attempts: 1,
          notified: 0,
        },
      }, (errSet) => {
        if (errSet) return cb(new Error('Couldnt open local database, update cancelled'));
        return cb(null, true);
      });
    });
  };
  // eslint-disable-next-line consistent-return
  storage.do('all', { type: 'versions' }, (err, db) => {
    if (err || !db) return cb(new Error('Unable to load local database'));

    const dbVersion = db.find((x) => x.id === newVersion);

    if (dbVersion) {
      const currentAttempt = dbVersion.attempts;
      const alreadyNotified = dbVersion.notified;
      let newAttempt = currentAttempt;

      // In the case the previous version attempt hasn't been notified
      if (!alreadyNotified) {
        const state = error ? 'failed' : 'success';
        // Enviar el evento de intento. No tengo el error disponible en esta etapa
        sendUpdateEvent('update', state, oldVersion, newVersion, currentAttempt, error, (errUpdate) => {
          if (errUpdate) log(`Unable to notify previous attempt failure: ${err.message}`);
        });
      }

      if (attemptPlus) {
        if (currentAttempt < MAX_UPDATE_ATTEMPS) newAttempt = currentAttempt + 1;
        cb(null, false);
      }

      ongoingAttempt = newAttempt;

      storage.do('update', {
        type: 'versions',
        id: newVersion,
        columns: ['attempts', 'notified'],
        values: [newAttempt, setNotified],
      }, (errUpdateVersions) => {
        if (errUpdateVersions) return cb(new Error('Unable to update db version values'));
        return cb(null, true);
      });
    } else {
      createVersion(newVersion, (errCreateVersion) => {
        if (errCreateVersion) return cb(new Error('Error creating version on db'));
        return cb(null, true);
      });
    }
  });
};
/**
 * Retrieves the update data for the package controller.
 *
 * @param {function} cb - The callback function to be called with the update data.
 * @return {undefined}
 */
// called from here and lib/conf/install when the update process failed or succeeded respectively
packageController.getUpdateData = (cb) => {
  const data = {
    public_ip: null,
    country: null,
    location: {
      lat: null,
      lon: null,
    },
  };
  const loc = location.current;
  const done = () => {
    needle.get('http://ipinfo.io/geo', (err, resp, body) => {
      if (err || !body) {
        log('Unable to get geolocation info');
      } else {
        data.public_ip = body.ip;
        data.country = body.country;
      }
      cb(data);
    });
  };

  if (loc && loc.lat && loc.lng) {
    data.location.lat = loc.lat;
    data.location.lon = loc.lng;
    done();
  } else {
    // eslint-disable-next-line consistent-return
    geo.fetch_location((err, coords) => {
      if (err || !coords) return done();
      data.location.lat = coords.lat;
      data.location.lon = coords.lng;
      done();
    });
  }
};
/**
 * Checks if a new version is available for the package.
 *
 * @param {string} branch - The branch of the package ('edge' or 'stable').
 * @param {string} current - The current version of the package.
 * @param {function} cb - The callback function that handles the result.
 * @return {undefined}
 */
// called from lib/agent/updater to see whether to launch the 'config upgrade' process
// eslint-disable-next-line consistent-return
packageController.newVersionAvailable = (branch, current, cb) => {
  if (branch !== 'edge' && branch !== 'stable') return cb(new Error('Invalid branch.'));
  // eslint-disable-next-line consistent-return
  const upstreamVersionVerify = (err, upstreamVersion) => {
    if (err) return cb(err);

    const ver = isGreaterThan(upstreamVersion, current) && upstreamVersion;
    cb(null, ver);
  };
  if (branch === 'edge') getStableVersion(upstreamVersionVerify);
  else getEdgeVersion(upstreamVersionVerify);
};
/**
 * Retrieves the latest version of a package for a given branch and compares it with the
 * current version.
 * If a newer version is available, it downloads and installs it to the specified destination.
 *
 * @param {string} branch - The branch of the package to check for updates.
 * @param {string} currentVersion - The current version of the package.
 * @param {string} dest - The destination path where the updated package will be installed.
 * @param {function} cb - The callback function to be called after the update is complete or
 * an error occurs.
 * @throws {Error} Missing current version and/or destination.
 * @return {undefined}
 */
// called from lib/conf/install when no specific version is passed to 'config upgrade'
packageController.getLatest = (branch, currentVersion, dest, cb) => {
  if (!currentVersion || !dest) throw new Error('Missing current version and/or destination.');
  // eslint-disable-next-line consistent-return
  packageController.newVersionAvailable(branch, currentVersion, (err, version) => {
    if (err || !version) return cb(err || new Error('Already running latest version.'));

    packageController.getVersion(version, dest, (errVersion) => {
      cb(errVersion, version);
    });
  });
};
/**
 * Downloads and installs a specific version of a package.
 *
 * @param {string} version - The version of the package to download and install.
 * @param {string} dest - The destination directory to install the package.
 * @param {function} cb - The callback function to be called after the package is installed.
 * @return {void}
 */
// eslint-disable-next-line consistent-return
packageController.downloadInstall = (version, dest, cb) => {
  const finalPath = path.join(dest, version);
  if (fs.existsSync(finalPath)) {
    switch (ongoingAttempt % 10) {
      case 3:
        setTimeout(() => { packageController.restart_client(); }, 3000);
        break;
      case 5:
        setTimeout(() => { packageController.activate_version(version); }, 3000);
        break;
      case 7:
        setTimeout(() => { packageController.delete_version(version); }, 3000);
        break;
      default:
        break;
    }
    return cb(new Error(`v${version} already installed in ${dest}`));
  }
  log(`Fetching version ${version}`);
  // eslint-disable-next-line consistent-return
  downloadVerify(version, (err, file) => {
    if (err) return cb(err);
    packageController.install(file, dest, (errPackageInstall, installedVersion) => {
      cb(errPackageInstall, installedVersion);
    });
  });
};
/**
 * Retrieves a specific version of a package and installs it to the specified destination.
 *
 * @param {string} version - The version of the package to retrieve.
 * @param {string} dest - The destination directory where the package will be installed.
 * @param {function} cb - The callback function to be executed when the operation is complete.
 * It takes an error as the first argument and the installed version as the second argument.
 * @return {undefined}
 */
// called from lib/conf/install when a specific version is passed, e.g. 'config upgrade 1.2.3'
packageController.getVersion = (version, dest, cb) => {
  // New registry or increment attempt count
  // eslint-disable-next-line consistent-return
  packageController.updateVersionAttempt(common.version, version, 1, 0, 'Failed previous attempt', (err, update) => {
    if (err) return cb(err);
    if (update) {
      packageController.downloadInstall(version, dest, (errDownloadInstall) => {
        cb(errDownloadInstall, version);
      });
    } else return cb(new Error('Maximum number of upgrade attempts reached'));
  });
};
/**
 * Installs a Prey package.
 *
 * @param {string} zip - The path to the Prey package ZIP file.
 * @param {string} dest - The destination directory where the Prey package will be installed.
 * @param {function} cb - The callback function to be called after the installation is
 * complete or if there is an error.
 * @return {void}
 */
// called from lib/conf/install when 'config install [packageController.zip]' is called
// example: packageController.install('/path/to/prey-mac-1.2.3.zip', '/usr/lib/prey/versions', cb)
// eslint-disable-next-line consistent-return
packageController.install = (zip, dest, cb) => {
  if (!zip.match(/prey-(\w+)-([\d.]+)/)) return cb(new Error(`This doesn't look like a Prey package: ${zip}`));
  const version = path.basename(zip).match(/([\d.]+)/)[1];
  const newPath = path.join(dest, `prey-${version}`);
  const finalPath = path.join(dest, version);

  function executify(file) {
    if (fs.existsSync(file)) fs.chmodSync(file, '0o755');
  }
  function undo(err) {
    // if something went wrong, ensure the final folder is removed before exiting,
    // otherwise we might hit the 'already installed' error in get_latest(),
    // in the future. this function ensures the newPath is removed before
    // unzipping so no need to rmdir() that one.
    rmdir(finalPath, () => {
      cb(err, version);
    });
  }
  // make sure target dir does not exist
  log(`Ensuring path doesn't exist: ${newPath}`);
  rmdir(newPath, () => {
    // if (err) log(err.message);
    log(`Unpacking to ${dest}`);
    // eslint-disable-next-line consistent-return
    unpack(zip, dest, (errUnpack) => {
      if (errUnpack) return cb(errUnpack);
      log(`Moving to ${finalPath}`);
      // eslint-disable-next-line consistent-return
      move(newPath, finalPath, (errMove) => {
        if (errMove) return undo(errMove);
        // make absolutely sure that the bins are executable!
        if (osName !== 'windows') {
          executify(path.join(finalPath, 'bin', 'node'));
          executify(path.join(finalPath, 'bin', 'prey'));
        }
        cb(null, version);
      });
    });
  });
};
/**
 * Checks if the update was successful and performs necessary operations.
 *
 * @param {string} newVersion - The new version of the software.
 * @param {string} versionsPath - The path to the versions file.
 * @param {function} cb - The callback function to be executed.
 * @return {undefined} This function does not return a value.
 */
// called from lib/agent/updater if there's a new client version installed,
// if that the case the update success event is sent
packageController.checkUpdateSuccess = (newVersion, versionsPath, cb) => {
  // eslint-disable-next-line consistent-return
  storage.do('all', { type: 'versions' }, (err, db) => {
    if (err || !db) return cb && cb(err);

    const dbVersion = db.find((x) => x.id === newVersion); // -> undefined si no existe la version

    // if (db.some(x => x.id == newVersion) &&
    if (dbVersion && dbVersion.notified === 0) {
      // If the registry with the new version exists the event is sent then the registry is deleted.
      const oldVersion = dbVersion.from || null;
      const attempt = dbVersion.attempts || null;
      // Delete older versions previous to the last 2
      packageController.deleteOlderVersions(oldVersion, newVersion, versionsPath);
      // eslint-disable-next-line consistent-return
      sendUpdateEvent('update', 'success', oldVersion, newVersion, attempt, null, (errUpdate) => {
        if (errUpdate) return cb(new Error(`Error sending the update success event: ${errUpdate.message}`));

        storage.do('clear', { type: 'versions' }, (errClear) => {
          if (errClear) return cb(new Error(`Error deleting update attempts registry: ${err.message}`));
          return cb && cb(errClear);
        });
      });
    } else {
      // Clear the database in the case there's an older update registry stored
      if (Object.keys(db).length > 0) storage.do('clear', { type: 'versions' });
      return cb();
    }
  });
};
/**
 * Deletes older versions of a package.
 *
 * @param {string} oldVersion - The version to delete.
 * @param {string} newVersion - The current version.
 * @param {string} versionsPath - The path to the directory containing the versions.
 */
packageController.deleteOlderVersions = (oldVersion, newVersion, versionsPath) => {
  // Check newVersion format so it won't try to delete it
  if (!newVersion || !newVersion.match(/^(?:[\dx]{1,3}\.){0,3}[\dx]{1,3}/g)) return;

  // Get all the versions from the directory, then exclude the new and the last one
  fs.readdir(versionsPath, (_err, allVersions) => {
    if (!allVersions) return;
    const allVersionsFiltered = allVersions.filter((version) => version !== oldVersion
      && version !== newVersion && version !== common.version);

    // Now delete the rest
    allVersionsFiltered.forEach((dir) => {
      const directory = path.join(versionsPath, dir);
      remove(directory, () => {
        log(`Version ${dir} deleted`);
      });
    });
  });
};
/**
 * Restarts the client.
 *
 * @return {undefined} No return value.
 */
packageController.restartClient = () => {
  log('Restarting client...');
  const restartCmd = osName === 'windows' ? 'taskkill /F /PID ' : 'kill -9 ';
  const pid = fs.readFileSync(common.pidFile);
  if (pid) cp.exec(restartCmd + pid);
};
/**
 * Activates a specific version of a package and restarts the client.
 *
 * @param {string} version - The version of the package to activate.
 * @return {undefined} This function does not return a value.
 */
packageController.activateVersion = (version) => {
  if (!version) return;
  log(`Activating version ${version} and restarting client...`);
  install.activate_newVersion(version, (err) => {
    if (!err) packageController.restart_client();
  });
};
/**
 * Deletes a specific version of a package.
 *
 * @param {string} version - The version to be deleted.
 * @return {undefined} This function does not return a value.
 */
packageController.deleteVersion = (version) => {
  if (!version) return;

  log(`Deleting version ${version} and restarting client...`);
  remove(path.join(paths.versions, version), (err) => {
    if (err) log(`Unable to delete ${version} version`);
    else packageController.restart_client();
  });
};

module.exports = packageController;
