/* eslint-disable consistent-return */
const { join } = require('path');
const satan = require('satan');
const { exec } = require('child_process');
const common = require('../../agent/common');
const { is_greater_or_equal: isGreaterOrEqual } = require('../../agent/helpers');
const paths = require('../../system/paths');

const logger = common.logger.prefix('actions');
const rootUser = 'root';
const oldWatchersKey = [{
  key: 'com.prey.owl',
  bin: join(`${paths.install}`, 'versions', 'prey-user'),
  plistPath: '/Library/LaunchDaemons/com.prey.owl.plist',
},
{
  key: 'com.prey.new_owl',
  bin: join(`${paths.install}`, 'versions', 'prey-user'),
  plistPath: '/Library/LaunchDaemons/com.prey.new_owl.plist',
}]; // list of all watchers used in Prey
const actualWatcherKey = 'com.prey.mac_svc';
const userPreyPath = '/Users/prey';

const watcherOpts = {
  key: actualWatcherKey,
  bin: join(`${paths.install}`, 'versions', 'prey-user'),
  user: rootUser,
  interval: 1800, // check every half hour
  name: 'New Prey Owl',
};

exports.cmdExistsCurrentBinMacSvc = `test -f ${join(paths.current, 'bin', 'mac_svc')} && echo exists`;
exports.cmdCurrentBinMacSvcVersion = `${join(paths.current, 'bin', 'mac_svc')} -v`;

exports.cmdExistsInstallVersionPreyUser = `test -f ${join(`${paths.install}`, 'versions', 'prey-user')} && echo exists`;
exports.cmdInstallVersionsreyUserVersion = `${join(`${paths.install}`, 'versions', 'prey-user')} -v`;

const currentPathPreyUser = join(paths.current, 'bin', 'mac_svc');
const installVersionsPath = join(`${paths.install}`, 'mac_svc');

exports.copyCurrentToInstallVersionPath = `/bin/cp ${currentPathPreyUser} ${installVersionsPath}`;

const source = join(paths.current, 'bin', 'prey-user');
const destination = join(paths.install, 'versions');
exports.copyToDestination = `/bin/cp ${source} ${destination}`;

const activeWatcher = (cb) => {
  exec(exports.copyToDestination, () => {
    exports.create_watcher((err) => {
      if (err) return;
      // wait one sec, then start. or half.
      setTimeout(() => {
        exports.start_watcher((error) => cb && cb(error));
      }, 500);
    });
  });
};

/**
 * check if exists the configuration of com.prey.owl.plist or com.prey.new_owl.plist
 * when the com.prey.new_owl.plist is found verify if the old .plis still exists and it's removed
 * and
 */
const testExistingConfigurations = (cb) => {
  exec(exports.existsNewPath, (_error, stdout) => {
    if (stdout && stdout.trim() !== '') {
      // look for old .plist and remove it
      oldWatchersKey.forEach((watcherKey) => {
        exec(`test -f ${watcherKey.plistPath} && echo exists`, (errorOldpath, stdoutOldpath) => {
          if (!stdoutOldpath || stdoutOldpath.trim() === '') {
            if (typeof cb === 'function') return cb && cb(`${watcherKey} doesn't exist: ${errorOldpath == null ? '' : errorOldpath}`);
            return;
          }
          exports.remove_single_watcher(watcherKey.key);
          exec(`rm -fr ${watcherKey.bin}`, (err) => cb && cb(`Delete prey binary in /prey/: ${err == null ? '' : err}`));
        });
      });
      exec(exports.copyCurrentToInstallVersionPath, (error) => {
        logger.error(`Error when copy file to destionation: ${error}`);
      });
    } else {
      activeWatcher(cb);
    }
  });
};

/**
 * if found version is equal or greather than the current version the execution code stop here,
 * otherwise otherwise check if exists the configuration
 * of com.prey.owl.plist or com.prey.new_owl.plist
 */
const compareVersionsDaemon = (preyUserOldVersion, preyUserVersion, cb) => {
  if (isGreaterOrEqual(preyUserOldVersion.trim(), preyUserVersion.trim())) {
    if (typeof (cb) === 'function') return cb && cb('New version < old version');
    return 0;
  }
  testExistingConfigurations(cb);
};

/**
 * check if prey-user and mac_svc exist install path
 * and versions path and delete it if is required
 */
const checkWatcherBin = (firstPath, secondPath, resolve, reject) => {
  exec(firstPath, (_error, stdout) => {
    if (stdout && stdout.trim() !== '') {
      if (secondPath) {
        exec(secondPath, (_errorSecond, stdoutSecond) => {
          if (stdout && stdout.trim() !== '') {
            resolve(stdoutSecond);
          } else reject(_errorSecond);
        });
      } else resolve(stdout);
    } else reject(_error);
  });
};

/**
 * get prey-user-version from installation folder (usr/local/lib/prey),
 * if it doesn't exist look for the prey-user in the versions folder
 * if a version is found, compares the daemon versions,
 * otherwise check if exists the configuration of com.prey.owl.plist or com.prey.new_owl.plist
 */
const getPreyUserVersions = (getPreyUserVersion, cb) => {
  const successHandler = (foundVersion) => {
    if (foundVersion) {
      compareVersionsDaemon(foundVersion, getPreyUserVersion, cb);
    } else {
      testExistingConfigurations(cb);
    }
  };

  const rejectHandler = (error) => {
    if (error) {
      return cb(error);
    }
    testExistingConfigurations(cb);
  };

  const versionPromise = new Promise((resolve, reject) => {
    checkWatcherBin(
      exports.cmdExistsInstallVersionPreyUser,
      exports.cmdInstallVersionsreyUserVersion,
      resolve,
      (err) => {
        if (err) return reject(err);
        checkWatcherBin(
          exports.cmdExistsInstallVersionPreyUser,
          exports.cmdInstallVersionsreyUserVersion,
          resolve,
          reject,
        );
      },
    );
  });

  versionPromise.then(successHandler, rejectHandler);
};

/*
 * verify current version of prey-user in order
 * to update the watcher configuration and create it if is needed
 */
exports.trigger_set_watcher = (cb) => {
  checkWatcherBin(
    exports.cmdExistsCurrentBinPreyUser,
    exports.cmdCurrentBinPreyUserVersion,
    () => {
      
      getPreyUserVersions(preyUserVersion, cb);
    },
    cb,
  );
  exec(exports.cmdExistsCurrentBinPreyUser, (errorSetWatcher, stdout) => {
    if (stdout) {
      exec(exports.cmdCurrentBinPreyUserVersion, (error, preyUserVersion) => {
        if (error) {
          return cb && cb(error);
        }
        getPreyUserVersions(preyUserVersion, cb);
      });
    } else {
      return cb && cb(errorSetWatcher);
    }
  });
};

const removeWatcher = (cb) => {
  satan.ensure_destroyed(actualWatcherKey, () => {
    exec(`/usr/bin/dscl . -delete "${userPreyPath}"`, (errorDelPreyUser) => cb && cb(errorDelPreyUser));
  });
};

exports.remove_single_watcher = (watchersToRemove, cb) => {
  if (Array.isArray(watchersToRemove)) {
    watchersToRemove.forEach((singleWatcherKey) => {
      satan.ensure_destroyed(singleWatcherKey, (error) => cb && cb(error));
    });
  } else {
    satan.ensure_destroyed(watchersToRemove, (error) => cb && cb(error));
  }
};

exports.start_watcher = (cb) => {
  satan.start(newWatcherKey, (error) => {
    if (typeof cb === 'function') return cb && cb(error);
    return true;
  });
};

exports.create_watcher = (cb) => {
  satan.ensure_created(watcherOpts, (err) => {
    if (err) return cb && cb(err);
    return cb && cb(null);
  });
};

exports.remove_watcher = removeWatcher;
