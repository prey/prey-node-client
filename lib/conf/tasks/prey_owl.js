const oldWatcherKey = 'com.prey.owl';
const newWatcherKey = 'com.prey.new_owl';
const userPreyPath = '/Users/prey';

const satan = require('satan');
const { join } = require('path');
const { exec } = require('child_process');
// eslint-disable-next-line camelcase
const { is_greater_or_equal, greaterOrEqual } = require('../../agent/helpers');
const system = require('../../system');
const paths = require('../../system/paths');
const common = require('../../agent/common');

const logger = common.logger.prefix('actions');
const rootUser = 'root';
const pathLaunchDaemon = '/Library/LaunchDaemons/';
const watcherOpts = {
  key: newWatcherKey,
  bin: join(`${paths.install}`, 'versions', 'prey-user'),
  user: rootUser,
  interval: 1800, // check every half hour
  name: 'New Prey Owl',
};

exports.cmdExistsCurrentBinPreyUser = `test -f ${join(paths.current, 'bin', 'prey-user')} && echo exists`;
exports.cmdCurrentBinPreyUserVersion = `${join(paths.current, 'bin', 'prey-user')} -v`;

exports.cmdExistInstallPreyUser = `test -f ${join(paths.install, 'prey-user')} && echo exists`;
exports.cmdInstallPreyUserVersion = `${join(paths.install, 'prey-user')} -v`;

exports.cmdExistsInstallVersionPreyUser = `test -f ${join(`${paths.install}`, 'versions', 'prey-user')} && echo exists`;
exports.cmdInstallVersionsreyUserVersion = `${join(`${paths.install}`, 'versions', 'prey-user')} -v`;

const newPath = `${pathLaunchDaemon + newWatcherKey}.plist`;
const oldPath = `${pathLaunchDaemon + oldWatcherKey}.plist`;
const currentPathPreyUser = join(paths.current, 'bin', 'prey-user');
const installVersionsPath = join(`${paths.install}`, 'versions', 'prey-user');

exports.existsNewPath = `test -f ${newPath} && echo exists`;
exports.existsOldpath = `test -f ${oldPath} && echo exists`;
exports.deleteInstallPreyUserBinary = `rm -fr ${join(`${paths.install}`, 'prey-user')}`;
exports.deleteInstallPreyUserPath = `rm -fr ${installVersionsPath}`;
exports.copyCurrentToInstallVersionPath = `/bin/cp ${currentPathPreyUser} ${installVersionsPath}`;

const source = join(paths.current, 'bin', 'prey-user');
const destination = join(paths.install, 'versions');
exports.copyToDestination = `/bin/cp ${source} ${destination}`;
/**
 * Function to test existing configurations.
 *
 * @param {Function} cb - Callback function to handle the result
 * @return {void}
 */
const testExistingConfigurations = (cb) => {
  exec(exports.existsNewPath, (_error, stdout) => {
    if (stdout && stdout.trim() !== '') {
      // look for old .plist and remove it
      // eslint-disable-next-line consistent-return
      exec(exports.existsOldpath, (errorOldpath, stdoutOldpath) => {
        if (!stdoutOldpath || stdoutOldpath.trim() === '') {
          return cb && cb(`com.prey.owl.plist doesn't exist: ${errorOldpath == null ? '' : errorOldpath}`);
        }
        exports.remove_single_watcher(oldWatcherKey);

        exec(exports.deleteInstallPreyUserBinary, (err) => cb && cb(`Delete prey binary in /prey/: ${err == null ? '' : err}`));
      });
      exec(`launchctl unload ${pathLaunchDaemon}${newWatcherKey}`, (errorUnload) => {
        if (errorUnload) logger.error(`Launchctl unload error: ${errorUnload}`);
        system.get_os_version((err, osVersion) => {
          if (err) {
            if (typeof cb !== 'function') return;
            return cb(err);
          }
          if (greaterOrEqual('13.0.0', osVersion)) {
            return exec(exports.deleteInstallPreyUserPath, () => {
              exec(exports.copyCurrentToInstallVersionPath, (error) => {
                if (error) logger.error(`Error when copy file to destionation: ${error}`);
                exec(`launchctl load ${pathLaunchDaemon}${newWatcherKey}`, (errorLoad) => {
                  if (errorLoad) logger.error(`Launchctl load error: ${errorLoad}`);
                });
              });
            });
          }
          exec(exports.copyCurrentToInstallVersionPath, (error) => {
            if (error) logger.error(`Error when copy file to destionation: ${error}`);
            exec(`launchctl load ${pathLaunchDaemon}${newWatcherKey}`, (errorLoad) => {
              if (errorLoad) logger.error(`Launchctl load error: ${errorLoad}`);
            });
          });
        });
      });
    } else {
      // eslint-disable-next-line no-use-before-define
      activeWatcher(cb);
    }
  });
};
/**
 * Compares two versions and executes a callback if the new version
 * is not greater than or equal to the old version.
 *
 * @param {string} preyUserOldVersion - The old version to compare
 * @param {string} preyUserVersion - The new version to compare
 * @param {function} cb - The callback function to execute
 * @return {number} 0 if the new version is greater than or equal to the old version
 */
// eslint-disable-next-line consistent-return
const compareVersionsDaemon = (preyUserOldVersion, preyUserVersion, cb) => {
  if (is_greater_or_equal(preyUserOldVersion.trim(), preyUserVersion.trim())) {
    if (typeof (cb) === 'function') return cb && cb('New version < old version');
    return 0;
  }
  testExistingConfigurations(cb);
};
/**
 * Generate the prey user versions and compare them using a promise.
 *
 * @param {string} preyUserVersion - The version of the prey user
 * @param {function} cb - The callback function
 * @return {void}
 */
const getPreyUserVersions = (preyUserVersion, cb) => {
  const successHandler = (foundVersion) => {
    if (foundVersion) {
      compareVersionsDaemon(foundVersion, preyUserVersion, cb);
    } else {
      testExistingConfigurations(cb);
    }
  };
  /**
   * Handle the rejection of a promise with the given error.
   *
   * @param {type} error - the error to be handled
   * @return {type} description of return value
   */
  // eslint-disable-next-line consistent-return
  const rejectHandler = (error) => {
    if (error) {
      return cb(error);
    }
    testExistingConfigurations(cb);
  };

  const versionPromise = new Promise((resolve, reject) => {
    exec(exports.cmdExistInstallPreyUser, (_parentError, parentStdout) => {
      if (parentStdout && parentStdout.trim() !== '') {
        exec(exports.cmdInstallPreyUserVersion, (error, preyUserVersionInstall) => {
          if (error) {
            reject(error);
          }
          resolve(preyUserVersionInstall);
        });
      } else {
        exec(
          exports.cmdExistsInstallVersionPreyUser,
          (_error, stdout) => {
            if (stdout && stdout.trim() !== '') {
              exec(
                exports.cmdInstallVersionsreyUserVersion,
                (childError, preyUserVersionExistInstall) => {
                  if (childError) {
                    reject(childError);
                  }
                  resolve(preyUserVersionExistInstall);
                },
              );
            } else {
              // eslint-disable-next-line prefer-promise-reject-errors
              reject(null);
            }
          },
        );
      }
    });
  });

  versionPromise.then(successHandler, rejectHandler);
};
/**
 * Executes a series of commands and returns the result to the callback function.
 *
 * @param {function} cb - The callback function to handle the result
 * @return {void}
 */
exports.trigger_set_watcher = (cb) => {
  // eslint-disable-next-line consistent-return
  exec(exports.cmdExistsCurrentBinPreyUser, (error, stdout) => {
    if (stdout) {
      // eslint-disable-next-line consistent-return
      exec(exports.cmdCurrentBinPreyUserVersion, (errorCurrent, preyUserVersion) => {
        if (errorCurrent) {
          return cb && cb(errorCurrent);
        }
        getPreyUserVersions(preyUserVersion, cb);
      });
    } else {
      return cb && cb(error);
    }
  });
};
/**
 * Executes a series of functions in a specific order to set up a watcher that starts after a delay.
 *
 * @param {Function} cb - Callback function to be executed after the watcher is set up
 * @return {void}
 */
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
 * Removes a watcher and ensures its destruction along with associated keys.
 *
 * @param {Function} cb - Callback function to be executed after removal
 * @return {void}
 */
const removeWatcher = (cb) => {
  satan.ensure_destroyed(newWatcherKey, () => {
    satan.ensure_destroyed(oldWatcherKey, (error) => {
      exec(`/usr/bin/dscl . -delete "${userPreyPath}"`, () => cb && cb(error));
    });
  });
};
/**
 * Removes a single watcher and ensures it is destroyed before invoking the callback if provided.
 *
 * @param {string} watcherKey - the key of the watcher to be removed
 * @param {function} cb - an optional callback function to be
 * called after ensuring the watcher is destroyed
 * @return {void}
 */
exports.remove_single_watcher = (watcherKey, cb) => {
  satan.ensure_destroyed(watcherKey, () => cb && cb());
};
/**
 * Start a watcher and execute the callback upon completion.
 *
 * @param {function} cb - The callback function to execute after starting the watcher
 * @return {boolean} Whether the watcher was started successfully
 */
exports.start_watcher = (cb) => {
  satan.start(newWatcherKey, (error) => {
    if (typeof cb === 'function') return cb && cb(error);
    return true;
  });
};
/**
 * Create a watcher with the given callback.
 *
 * @param {function} cb - The callback function
 * @return {void}
 */
exports.create_watcher = (cb) => {
  satan.ensure_created(watcherOpts, (err) => {
    if (err) return cb && cb(err);
    return cb && cb(null);
  });
};

exports.remove_watcher = removeWatcher;
