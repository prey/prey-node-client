const old_watcher_key = 'com.prey.owl',
  new_watcher_key = 'com.prey.new_owl',
  user_prey_path = '/Users/prey';

var satan = require('satan'),
  join = require('path').join,
  is_greater_or_equal = require('../../agent/helpers').is_greater_or_equal,
  paths = require('./../../system/paths'),
  exec = require('child_process').exec,
  common = require('../../agent/common'),
  logger  = common.logger.prefix('actions'),
  root_user = 'root',
  path_launch_daemon = '/Library/LaunchDaemons/',
  watcher_opts = {
    key: new_watcher_key,
    bin: join(`${paths.install}`, 'versions', 'prey-user'),
    user: root_user,
    interval: 1800, // check every half hour
    name: 'New Prey Owl',
  };

exports.cmdExistsCurrentBinPreyUser = `test -f ${join(paths.current, 'bin', 'prey-user')} && echo exists`;
exports.cmdCurrentBinPreyUserVersion = `${join(paths.current, 'bin', 'prey-user')} -v`;

exports.cmdExistInstallPreyUser = `test -f ${join(paths.install, 'prey-user')} && echo exists`;
exports.cmdInstallPreyUserVersion = `${join(paths.install, 'prey-user')} -v`;

exports.cmdExistsInstallVersionPreyUser = `test -f ${join(`${paths.install}`, 'versions', 'prey-user')} && echo exists`;
exports.cmdInstallVersionsreyUserVersion = `${join(`${paths.install}`, 'versions', 'prey-user')} -v`;


const newPath = path_launch_daemon + new_watcher_key + '.plist';
const oldPath = path_launch_daemon + old_watcher_key + '.plist';
const current_path_prey_user = join(paths.current, 'bin', 'prey-user');
const install_versions_path = join(`${paths.install}`, 'versions', 'prey-user');

exports.existsNewPath = `test -f ${newPath} && echo exists`;
exports.existsOldpath = `test -f ${oldPath} && echo exists`;
exports.deleteInstallPreyUserBinary = `rm -fr ${join(`${paths.install}`, 'prey-user')}`;
exports.copyCurrentToInstallVersionPath = `/bin/cp ${current_path_prey_user} ${install_versions_path}`;

const source = join(paths.current, 'bin', 'prey-user');
const destination = join(paths.install, 'versions');
exports.copyToDestination = `/bin/cp ${source} ${destination}`;

/*
 * verify current version of prey-user in order to update the watcher configuration and create it if is needed
 */
exports.trigger_set_watcher = (cb) => {
  exec(exports.cmdExistsCurrentBinPreyUser, (error, stdout) => {
      if (stdout) {
        exec(exports.cmdCurrentBinPreyUserVersion, (error, prey_user_version) => {
            if (error) {
              return cb && cb(error);
            }
            get_prey_user_versions(prey_user_version, cb);
          }
        );
      } else {
        return cb && cb(error);
      }
    }
  );
};

// get prey-user-version from installation folder (usr/local/lib/prey), if it doesn't exist look for the prey-user in the versions folder
// if a version is found, compares the daemon versions, otherwise check if exists the configuration of com.prey.owl.plist or com.prey.new_owl.plist
const get_prey_user_versions = (preyUserVersion, cb) => {
  const success_handler = (foundVersion) => {
    if (foundVersion) {
      compareVersionsDaemon(foundVersion, preyUserVersion, cb);
    } else {
      testExistingConfigurations(cb);
    }
  };

  const reject_handler = (error) => {
    if (error) {
      return cb(error);
    }
    testExistingConfigurations(cb);
  };

  const versionPromise = new Promise((resolve, reject) => {
    exec(exports.cmdExistInstallPreyUser, (_parent_error, parent_stdout) => {
        if (parent_stdout && parent_stdout.trim() !== '') {
          exec(exports.cmdInstallPreyUserVersion, (error, prey_user_version) => {
              if (error) {
                reject(error);
              }
              resolve(prey_user_version);
            }
          );
        } else {
          exec(exports.cmdExistsInstallVersionPreyUser,
            (_error, stdout) => {
              if (stdout && stdout.trim() !== '') {
                exec(exports.cmdInstallVersionsreyUserVersion, (child_error, prey_user_version) => {
                    if (child_error) {
                      reject(child_error);
                    }
                    resolve(prey_user_version);
                  }
                );
              }else {
                reject(null);
              }
            }
          );
        }
      }
    );
  });

  versionPromise.then(success_handler, reject_handler);
};

// if found version is equal or greather than the current version the execution code stop here,
// otherwise otherwise check if exists the configuration of com.prey.owl.plist or com.prey.new_owl.plist
const compareVersionsDaemon = (preyUserOldVersion, preyUserVersion, cb) => {
  if (is_greater_or_equal(preyUserOldVersion.trim(), preyUserVersion.trim())) {
    return cb && cb("New version < old version");
  }
  testExistingConfigurations(cb);
};

// check if exists the configuration of com.prey.owl.plist or com.prey.new_owl.plist
// when the com.prey.new_owl.plist is found verify if the old .plis still exists and it's removed
// and
const testExistingConfigurations = (cb) => {
  exec(exports.existsNewPath, (_error, stdout) => {
    if (stdout && stdout.trim() !== '') {
      // look for old .plist and remove it
      exec(exports.existsOldpath, (error_oldpath, stdout_oldpath) => {
        if (!stdout_oldpath || stdout_oldpath.trim() === '') {
          return cb && cb(`com.prey.owl.plist doesn't exist: ${error_oldpath == null ? '' : error_oldpath}`);
        }
        exports.remove_single_watcher(old_watcher_key);

        exec(exports.deleteInstallPreyUserBinary, (err) => {
          return cb && cb(`Delete prey binary in /prey/: ${err == null ? '' : err}`);
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

const activeWatcher = (cb) => {
  exec(exports.copyToDestination, () => {
    exports.create_watcher((err) => {
      if (err) return;
      // wait one sec, then start. or half.
      setTimeout(function () {
        exports.start_watcher((error) => {
          return cb && cb(error);
        });
      }, 500);
    });
  });
};

const remove_watcher = (cb) => {
  satan.ensure_destroyed(new_watcher_key, () => {
    satan.ensure_destroyed(old_watcher_key, (error) => {
      exec(`/usr/bin/dscl . -delete "${user_prey_path}"`, () => {
        return cb && cb(error);
      });
    });
  });
};

exports.remove_single_watcher = (watcher_key, cb) => {
  satan.ensure_destroyed(watcher_key, () => {
    return cb && cb(error);
  });
};

exports.start_watcher = (cb)=> {
  satan.start(new_watcher_key, (error) => {
    if (typeof cb === 'function')
      return cb && cb(error);
    return true;
  });
};

exports.create_watcher = (cb) => {
  satan.ensure_created(watcher_opts, (err) => {
    if (err) return cb && cb(err);
    return cb && cb(null);
  });
};

exports.remove_watcher = remove_watcher;
