// @ts-check
const oldWatcherKey = 'com.prey.owl';
const newWatcherKey = 'com.prey.new_owl';
const userPreyPath = '/Users/prey';

const fs = require('fs');
const satan = require('satan');
const { join } = require('path');
const { exec } = require('child_process');
// eslint-disable-next-line camelcase
const { is_greater_or_equal, greaterOrEqual } = require('../../agent/helpers');
const system = require('../../system');
const paths = require('../../system/paths');
const common = require('../../agent/common');

const logger = common.logger.prefix('actions');

const INSTALL_LOG = '/tmp/installation_prey.log';
const log_install = (msg) => {
  try {
    const ts = new Date().toISOString().replace('T', ' ').replace('Z', '');
    fs.appendFileSync(INSTALL_LOG, `[${ts}] [prey_owl] ${msg}\n`);
  } catch (e) { /* never throw from logger */ }
};
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
 * Polls pgrep until the named process has exited or the timeout elapses.
 *
 * @param {string} processName - The process name to wait for
 * @param {number} timeoutMs - Maximum milliseconds to wait
 * @param {Function} cb - Called with no arguments when the process has stopped,
 *                        or with an Error if the timeout is exceeded
 * @return {void}
 */
const waitForProcessToStop = (processName, timeoutMs, cb) => {
  const interval = 500;
  let elapsed = 0;
  const check = () => {
    exec(`pgrep -x ${processName}`, (err, stdout) => {
      if (!stdout || stdout.trim() === '') return cb(null);
      elapsed += interval;
      if (elapsed >= timeoutMs) return cb(new Error(`${processName} still running after ${timeoutMs}ms`));
      setTimeout(check, interval);
    });
  };
  check();
};
const testExistingConfigurations = (cb) => {
  log_install(`testExistingConfigurations: checking for ${newPath}`);
  exec(exports.existsNewPath, { timeout: 5000 }, (_error, stdout) => {
    if (stdout && stdout.trim() !== '') {
      // Upgrade path: com.prey.new_owl.plist already exists.
      // Serialized sequence: unload → wait → cleanup legacy → copy binary → load → cb
      log_install('com.prey.new_owl.plist found — running upgrade path');

      // Step 1: Unload the running daemon so we can replace the binary safely
      log_install(`launchctl unload ${newWatcherKey}...`);
      exec(`launchctl unload ${pathLaunchDaemon}${newWatcherKey}`, { timeout: 15000 }, (errorUnload) => {
        if (errorUnload) logger.error(`Launchctl unload error: ${errorUnload}`);
        log_install(`launchctl unload: ${errorUnload ? `FAILED: ${errorUnload}` : 'OK'}`);

        // Step 2: Wait for the prey-user process to fully exit
        log_install('Waiting for prey-user process to stop...');
        waitForProcessToStop('prey-user', 15000, (waitErr) => {
          if (waitErr) logger.error(`Wait for prey-user to stop: ${waitErr}`);
          log_install(`prey-user stopped: ${waitErr ? `TIMEOUT/ERROR: ${waitErr}` : 'OK'}`);

          // Step 3: Clean up legacy com.prey.owl plist if still present (fire-and-forget)
          exec(exports.existsOldpath, { timeout: 5000 }, (_errOld, stdoutOldpath) => {
            if (stdoutOldpath && stdoutOldpath.trim() !== '') {
              log_install('com.prey.owl.plist found — removing legacy watcher and binary');
              exports.remove_single_watcher(oldWatcherKey);
              exec(exports.deleteInstallPreyUserBinary, { timeout: 10000 }, (delBinErr) => {
                log_install(`deleted legacy prey-user binary: ${delBinErr ? `FAILED: ${delBinErr}` : 'OK'}`);
              });
            } else {
              log_install('com.prey.owl.plist not present — skipping legacy cleanup');
            }

            // Step 4: Copy new binary and reload daemon. cb is called only after launchctl load.
            system.get_os_version((err, osVersion) => {
              if (err) logger.error(`get_os_version error: ${err}`);
              log_install(`macOS version: ${err ? 'unknown' : osVersion}`);

              const doLoadDaemon = (done) => {
                log_install('Copying prey-user to versions path...');
                exec(exports.copyCurrentToInstallVersionPath, { timeout: 10000 }, (copyError) => {
                  if (copyError) logger.error(`Error copying prey-user: ${copyError}`);
                  log_install(`prey-user copy: ${copyError ? `FAILED: ${copyError}` : 'OK'}`);
                  log_install(`launchctl load ${newWatcherKey}...`);
                  exec(`launchctl load ${pathLaunchDaemon}${newWatcherKey}`, { timeout: 15000 }, (errorLoad) => {
                    if (errorLoad) logger.error(`Launchctl load error: ${errorLoad}`);
                    log_install(`launchctl load: ${errorLoad ? `FAILED: ${errorLoad}` : 'OK — prey-user daemon started'}`);
                    typeof done === 'function' && done(copyError || errorLoad || null);
                  });
                });
              };

              if (!err && greaterOrEqual(osVersion, '13.0.0')) {
                log_install('macOS >= 13: deleting old versions/prey-user before copy');
                exec(exports.deleteInstallPreyUserPath, { timeout: 10000 }, (delErr) => {
                  if (delErr) logger.error(`Delete install prey-user error: ${delErr}`);
                  doLoadDaemon(cb);
                });
              } else {
                doLoadDaemon(cb);
              }
            });
          });
        });
      });
    } else {
      // Fresh install path: plist does not exist yet
      log_install('com.prey.new_owl.plist not found — running fresh install path');
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
   * @param {Error|null} error - the error to be handled
   * @return {void}
   */
  // eslint-disable-next-line consistent-return
  const rejectHandler = (error) => {
    if (error) {
      return cb(error);
    }
    testExistingConfigurations(cb);
  };

  const versionPromise = new Promise((resolve, reject) => {
    exec(exports.cmdExistInstallPreyUser, { timeout: 5000 }, (_parentError, parentStdout) => {
      if (parentStdout && parentStdout.trim() !== '') {
        exec(exports.cmdInstallPreyUserVersion, { timeout: 5000 }, (error, preyUserVersionInstall) => {
          if (error) {
            reject(error);
          }
          resolve(preyUserVersionInstall);
        });
      } else {
        exec(
          exports.cmdExistsInstallVersionPreyUser,
          { timeout: 5000 },
          (_error, stdout) => {
            if (stdout && stdout.trim() !== '') {
              exec(
                exports.cmdInstallVersionsreyUserVersion,
                { timeout: 5000 },
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
exports.trigger_set_watcher = (cb) => {
  log_install('trigger_set_watcher: START');
  log_install(`  checking prey-user at: ${join(paths.current, 'bin', 'prey-user')}`);
  exec(exports.cmdExistsCurrentBinPreyUser, { timeout: 5000 }, (error, stdout) => {
    if (stdout && stdout.trim() !== '') {
      log_install('  prey-user found in current/bin — getting version');
      exec(exports.cmdCurrentBinPreyUserVersion, { timeout: 5000 }, (errorCurrent, preyUserVersion) => {
        if (errorCurrent) {
          log_install(`  prey-user version error: ${errorCurrent}`);
          return cb && cb(errorCurrent);
        }
        log_install(`  prey-user version: ${(preyUserVersion || '').trim()}`);
        getPreyUserVersions(preyUserVersion, cb);
      });
    } else {
      // Binary not found at current/bin — attempt watcher setup anyway via testExistingConfigurations
      log_install(`  prey-user NOT found in current/bin (shell error: ${error}) — attempting watcher setup anyway`);
      logger.error(`prey-user not found at ${join(paths.current, 'bin', 'prey-user')}: ${error}`);
      testExistingConfigurations(cb);
    }
  });
};
const activeWatcher = (cb) => {
  log_install('activeWatcher: START — copying prey-user and creating fresh daemon');
  exec(exports.copyToDestination, { timeout: 10000 }, (copyErr) => {
    if (copyErr) logger.error(`Error copying prey-user to destination: ${copyErr}`);
    log_install(`  prey-user copy to versions dir: ${copyErr ? `FAILED: ${copyErr}` : 'OK'}`);
    exports.create_watcher((err) => {
      if (err) {
        logger.error(`create_watcher failed: ${err}`);
        log_install(`  create_watcher: FAILED: ${err}`);
        return typeof cb === 'function' && cb(err);
      }
      log_install('  create_watcher: OK — starting daemon in 500ms');
      setTimeout(() => {
        exports.start_watcher((error) => {
          log_install(`  start_watcher: ${error ? `FAILED: ${error}` : 'OK — prey-user daemon running'}`);
          typeof cb === 'function' && cb(error);
        });
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
      exec(`/usr/bin/dscl . -delete "${userPreyPath}"`, { timeout: 10000 }, () => cb && cb(error));
    });
  });
};
/**
 * Removes a single watcher and ensures it is destroyed before invoking the callback if provided.
 *
 * @param {string} watcherKey - the key of the watcher to be removed
 * @param {function} [cb] - an optional callback function to be
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
 * @return {void}
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
