// @ts-check
const oldWatcherKey = 'com.prey.owl';
const newWatcherKey = 'com.prey.new_owl';
const userPreyPath = '/Users/prey';

const fs = require('fs');
const satan = require('satan');
const { join } = require('path');
const { exec, spawn } = require('child_process');
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

// Seconds the reload helper waits, so the set_watcher call that scheduled it can
// return to the daemon before launchd kills that daemon.
const RELOAD_DELAY_SECONDS = 5;
// kickstart -k kills and relaunches the job in one launchd operation; bootstrap
// is the fallback when the job is not loaded at all.
exports.cmdReloadDaemon = `sleep ${RELOAD_DELAY_SECONDS}; `
  + `/bin/launchctl kickstart -k system/${newWatcherKey} `
  + `|| /bin/launchctl bootstrap system ${newPath}`;
// The daemon is treated as stale only if it started this long before its binary changed.
const STALE_MARGIN_MS = 5000;

/**
 * Restarts the prey-user daemon from a detached process.
 *
 * set_watcher usually runs as a child of the prey-user daemon itself. Restarting
 * the job makes launchd kill the job's process group, which would include this
 * process. A detached child gets its own session and process group, so it
 * survives that kill and finishes the restart. It is not waited for.
 *
 * @param {string} reason - Why the reload is needed, for the installation log
 * @return {void}
 */
const scheduleDaemonReload = (reason) => {
  log_install(`scheduling prey-user daemon reload in ${RELOAD_DELAY_SECONDS}s (${reason})`);
  /** @type {import('child_process').StdioOptions} */
  let stdio = 'ignore';
  try {
    const fd = fs.openSync(INSTALL_LOG, 'a');
    stdio = ['ignore', fd, fd];
  } catch (e) { /* reload still runs, just without its output in the log */ }

  try {
    const child = spawn('/bin/sh', ['-c', exports.cmdReloadDaemon], { detached: true, stdio });
    child.on('error', (err) => logger.error(`prey-user daemon reload failed to start: ${err}`));
    child.unref();
  } catch (e) {
    logger.error(`prey-user daemon reload failed to start: ${e}`);
    log_install(`daemon reload spawn FAILED: ${e}`);
  }
};

/**
 * Checks whether the running prey-user daemon started before its binary in
 * versions/ was last replaced, meaning it still runs the previous binary.
 *
 * @param {(stale: boolean) => void} cb - Called with true only when stale;
 *   any error (no process, ps or stat failure) counts as not stale
 * @return {void}
 */
const isDaemonStale = (cb) => {
  exec('/bin/ps -axo lstart=,command=', { timeout: 5000 }, (psErr, stdout) => {
    if (psErr) {
      log_install(`stale daemon check: ps failed: ${psErr}`);
      return cb(false);
    }
    const line = String(stdout || '').split('\n')
      .find((l) => l.trim().endsWith(installVersionsPath));
    if (!line) {
      log_install('stale daemon check: prey-user daemon not running');
      return cb(false);
    }
    // lstart is a fixed 24-char local date, e.g. "Fri Nov 20 18:51:14 2026".
    const startedAt = new Date(line.trim().slice(0, 24)).getTime();
    return fs.stat(installVersionsPath, (statErr, stats) => {
      if (statErr || Number.isNaN(startedAt)) {
        log_install(`stale daemon check: cannot compare (${statErr || 'unparsed start time'})`);
        return cb(false);
      }
      return cb(startedAt + STALE_MARGIN_MS < stats.mtime.getTime());
    });
  });
};

/**
 * Upgrade path: replaces versions/prey-user and restarts the daemon, or creates
 * the daemon when its plist does not exist yet.
 *
 * @param {(err?: (Error|string|null)) => void} cb - Called once the binary is
 *   in place (the restart happens a few seconds later, detached)
 * @return {void}
 */
const testExistingConfigurations = (cb) => {
  log_install(`testExistingConfigurations: checking for ${newPath}`);
  exec(exports.existsNewPath, { timeout: 5000 }, (_error, stdout) => {
    if (stdout && stdout.trim() !== '') {
      // Upgrade path: com.prey.new_owl.plist already exists.
      // Sequence: cleanup legacy → replace binary → detached daemon restart → cb.
      // The running daemon keeps its old binary in memory until restarted, so
      // replacing the file first is safe.
      log_install('com.prey.new_owl.plist found — running upgrade path');

      // Step 1: Clean up legacy com.prey.owl plist if still present (fire-and-forget)
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

        // Step 2: Copy the new binary, then restart the daemon only if the copy worked.
        system.get_os_version((err, osVersion) => {
          if (err) logger.error(`get_os_version error: ${err}`);
          log_install(`macOS version: ${err ? 'unknown' : osVersion}`);

          const doReplaceBinary = () => {
            log_install('Copying prey-user to versions path...');
            exec(exports.copyCurrentToInstallVersionPath, { timeout: 10000 }, (copyError) => {
              if (copyError) {
                // Restarting now could leave launchd without a binary to run.
                logger.error(`Error copying prey-user: ${copyError}`);
                log_install(`prey-user copy: FAILED: ${copyError} — daemon not restarted`);
                if (typeof cb === 'function') cb(copyError);
                return;
              }
              log_install('prey-user copy: OK');
              scheduleDaemonReload('binary upgraded');
              if (typeof cb === 'function') cb(null);
            });
          };

          if (!err && greaterOrEqual(osVersion, '13.0.0')) {
            log_install('macOS >= 13: deleting old versions/prey-user before copy');
            exec(exports.deleteInstallPreyUserPath, { timeout: 10000 }, (delErr) => {
              if (delErr) logger.error(`Delete install prey-user error: ${delErr}`);
              doReplaceBinary();
            });
          } else {
            doReplaceBinary();
          }
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
 * When the binary is already up to date, it also restarts a daemon that still
 * runs the previous binary (left behind by an upgrade that did not restart it).
 *
 * @param {string} preyUserOldVersion - The installed (versions/) version
 * @param {string} preyUserVersion - The version in current/bin
 * @param {(err?: (Error|string|null)) => void} cb - The callback function to execute
 * @return {void}
 */
const compareVersionsDaemon = (preyUserOldVersion, preyUserVersion, cb) => {
  if (is_greater_or_equal(preyUserOldVersion.trim(), preyUserVersion.trim())) {
    isDaemonStale((stale) => {
      if (stale) scheduleDaemonReload('daemon older than its binary');
      if (typeof cb === 'function') cb('New version < old version');
    });
    return;
  }
  testExistingConfigurations(cb);
};
/**
 * Generate the prey user versions and compare them using a promise.
 *
 * @param {string} preyUserVersion - The version of the prey user
 * @param {(err?: (Error|string|null)) => void} cb - The callback function
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
