const oldWatcherKey = 'com.prey.owl';
const newWatcherKey = 'com.prey.new_owl';
const macSVCWatcherKey = 'com.prey.mac_sv';
const userPreyPath = '/Users/prey';

const satan = require('satan');
const { join } = require('path');
const { exec } = require('child_process');
// eslint-disable-next-line camelcase
const { is_greater_or_equal } = require('../../agent/helpers');
const paths = require('../../system/paths');
const common = require('../../agent/common');

const logger = common.logger.prefix('actions');
const rootUser = 'root';
const pathLaunchDaemon = '/Library/LaunchDaemons/';
const watcherOpts = {
  key: macSVCWatcherKey,
  bin: join(`${paths.install}`, 'mac-svc'),
  user: rootUser,
  interval: 1800, // check every half hour
  name: 'Mac SVC watcher',
};

const cmdExistsMacSVC = `test -f ${join(paths.current, 'mac-svc')} && echo exists`;
const cmdVersionMacSVC = `${join(paths.current, 'mac-svc')} -v`;

const cmdExistsBinMacSVC = `test -f ${join(paths.current, 'bin', 'mac-svc')} && echo exists`;
const cmdVersionBinMacSVC = `${join(paths.current, 'bin', 'mac-svc')} -v`;

const cmdExistsVersionPreyUser = `test -f ${join(`${paths.install}`, 'versions', 'prey-user')} && echo exists`;
const cmdVersionsPreyUserVersion = `${join(`${paths.install}`, 'versions', 'prey-user')} -v`;

const newPath = `${pathLaunchDaemon + newWatcherKey}.plist`;
const oldPath = `${pathLaunchDaemon + oldWatcherKey}.plist`;
const currentPathPreyUser = join(paths.current, 'bin', 'prey-user');
const installVersionsPath = join(`${paths.install}`, 'versions', 'prey-user');

exports.existsNewPath = `test -f ${newPath} && echo exists`;
exports.existsOldpath = `test -f ${oldPath} && echo exists`;
exports.deleteInstallPreyUserBinary = `rm -fr ${join(`${paths.install}`, 'prey-user')}`;
exports.copyCurrentToInstallVersionPath = `/bin/cp ${currentPathPreyUser} ${installVersionsPath}`;

const source = join(paths.current, 'bin', 'mac-svc');
const destination = paths.install;
const copyToDestination = `/bin/cp ${source} ${destination}`;
/**
 * Executes a watcher creation and starts it after a delay.
 *
 * @param {function} cb - Callback function to be executed after starting the watcher
 * @return {void}
 */
const activeWatcher = (cb) => {
  exports.create_watcher((err) => {
    if (err) return;
    // wait one sec, then start. or half.
    setTimeout(() => {
      exports.start_watcher((error) => cb && cb(error));
    }, 500);
  });
};
/**
 * Verify the existence and version of a command.
 *
 * @param {string} cmdExists - The command to check for existence.
 * @param {Function} cmdVersion - The function to retrieve the command version.
 * @param {Function} cb - The callback function to handle the result.
 * @return {void}
 */
const verifyExistAndVersion = (cmdExists, cmdVersion, cb) => {
  // eslint-disable-next-line consistent-return
  exec(cmdExists, (error, stdout) => {
    if (error) return cb && cb(error);
    if (stdout && stdout.trim() !== '') {
      // eslint-disable-next-line consistent-return
      exec(cmdVersion, (errorCmdVersion, binVersion) => {
        if (errorCmdVersion) {
          return cb && cb(errorCmdVersion);
        }
        return cb && cb(null, binVersion);
      });
    } else return cb && cb(null);
  });
};
/**
 * Compare two versions and execute a callback based on the result.
 *
 * @param {string} preyUserOldVersion - the old version to compare
 * @param {string} preyUserVersion - the new version to compare
 * @param {function} cb - the callback function to execute
 * @return {number} 0 if no callback is provided, or the result of the callback
 */
const compareVersionsDaemon = (preyUserOldVersion, preyUserVersion, cb) => {
  if (is_greater_or_equal(preyUserOldVersion.trim(), preyUserVersion.trim())) {
    if (typeof (cb) === 'function') return cb('New version < old version');
    return 0;
  }
  if (typeof (cb) === 'function') return cb(null, true);
  return 0;
};


const deleteOlderConfigurations = (watcherInfo, cmdExistsInstall, cmdInstallVersions, cb) => {
  // eslint-disable-next-line max-len, consistent-return
  verifyExistAndVersion(cmdExistsInstall, cmdInstallVersions, (error, binVersion) => {
    if (error || (!error && !binVersion)) {
      return cb && cb(error);
    }
    exports.remove_single_watcher(watcherInfo.key);
    exec(`rm -fr ${watcherInfo.bin}`, (err) => cb && cb(`Delete prey binary in /prey/: ${err == null ? '' : err}`));
  });
};
/**
 * Trigger the watcher with the given callback.
 *
 * @param {function} cb - The callback function to be executed
 * @return {void}
 */
exports.trigger_set_watcher = (cb) => {
  const watcherInfo = {
    key: newWatcherKey,
    bin: `${join(`${paths.install}`, 'versions', 'prey-user')}`,
  };
  // eslint-disable-next-line max-len
  deleteOlderConfigurations(watcherInfo, cmdExistsVersionPreyUser, cmdVersionsPreyUserVersion, () => {
    // eslint-disable-next-line consistent-return
    verifyExistAndVersion(cmdExistsMacSVC, cmdVersionMacSVC, (error, macSVCVersion) => {
      if (error) return cb && cb(error);
      if (!error && !macSVCVersion) return activeWatcher(cb);
      // eslint-disable-next-line consistent-return, max-len
      verifyExistAndVersion(cmdExistsBinMacSVC, cmdVersionBinMacSVC, (errorBin, binMacSVCVersion) => {
        if (errorBin) {
          return cb && cb(errorBin);
        }
        // eslint-disable-next-line consistent-return
        compareVersionsDaemon(macSVCVersion, binMacSVCVersion, (errorComparation, isGreater) => {
          if (errorComparation) return cb && cb(errorBin);
          if (isGreater) {
            // eslint-disable-next-line max-len
            exec(copyToDestination, (errorCopyToDestination) => cb && cb(errorCopyToDestination));
          }
        });
      });
    });
  });
};

const removeWatcher = (cb) => {
  satan.ensure_destroyed(newWatcherKey, () => {
    satan.ensure_destroyed(oldWatcherKey, () => {
      satan.ensure_destroyed(macSVCWatcherKey, (error) => {
        exec(`/usr/bin/dscl . -delete "${userPreyPath}"`, () => cb && cb(error));
      });
    });
  });
};

exports.remove_single_watcher = (watcherKey, cb) => {
  satan.ensure_destroyed(watcherKey, (error) => cb && cb(error));
};

exports.start_watcher = (cb) => {
  satan.start(macSVCWatcherKey, (error) => {
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
