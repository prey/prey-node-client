const fs = require('fs');
const path = require('path');
const needle = require('needle');
const { createHash } = require('crypto');
const rmdir = require('rimraf');
const cp = require('child_process');
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

const log = (str) => {
  if (process.stdout.writable) process.stdout.write(`${str}\n`);
};

// returns sha1 checksum for file
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

// eslint-disable-next-line consistent-return
const unpack = (zip, dest, cb) => {
  if (process.platform !== 'darwin') return delayed.buckle.open(zip, dest, cb);

  // on OSX, we'll use ditto to ensure extended attributes are kept
  const cmd = `ditto -xk ${zip} ${dest}`;

  // increase maxBuffer to avoid [stderr maxBuffer exceeded]
  cp.exec(cmd, { maxBuffer: 1024 * 1024 * 64 }, cb);
};
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
// eslint-disable-next-line consistent-return
const move = (from, to, cb) => {
  if (process.platform !== 'win32') return fs.rename(from, to, cb);
  likeABoss(from, to, 1, cb);
};

const packageController = {};

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

const getEdgeVersion = (cb) => {
  // eslint-disable-next-line consistent-return
  needle.get(npmPackageControllerUrl, { parse: true }, (err, resp, body) => {
    if (err) return cb(err);
    const version = body['dist-tags'] && body['dist-tags'].latest;
    if (version) return cb(null, version.toString().trim());
    cb(new Error('Unable to figure out latest edge version.'));
  });
};

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
packageController.postEvent = (data, cb) => {
  const urlTelemetry = 'https://solid.preyproject.com/api/v2/telemetry';

  const opts = {
    json: true,
    user_agent: system.user_agent,
  };
  needle.post(urlTelemetry, data, opts, (err) => cb && cb(err));
};

packageController.deleteAttempts = (cb) => {
  storage.do('clear', { type: 'versions' }, (err) => {
    if (err) return cb(new Error(`Error deleting update attempts registry: ${err.message}`));
    return cb && cb(err);
  });
};

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

packageController.restartClient = () => {
  log('Restarting client...');
  const restartCmd = osName === 'windows' ? 'taskkill /F /PID ' : 'kill -9 ';
  const pid = fs.readFileSync(common.pidFile);
  if (pid) cp.exec(restartCmd + pid);
};

packageController.activateVersion = (version) => {
  if (!version) return;
  log(`Activating version ${version} and restarting client...`);
  install.activate_newVersion(version, (err) => {
    if (!err) packageController.restart_client();
  });
};

packageController.deleteVersion = (version) => {
  if (!version) return;

  log(`Deleting version ${version} and restarting client...`);
  remove(path.join(paths.versions, version), (err) => {
    if (err) log(`Unable to delete ${version} version`);
    else packageController.restart_client();
  });
};

module.exports = packageController;
