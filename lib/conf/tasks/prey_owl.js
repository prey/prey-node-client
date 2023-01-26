const old_watcher_key = 'com.prey.owl',
  new_watcher_key = 'com.prey.new_owl',
  user_prey_path = '/Users/prey';

var satan = require('satan'),
  join = require('path').join,
  is_greater_or_equal = require('../../agent/helpers').is_greater_or_equal,
  paths = require('./../../system/paths'),
  exec = require('child_process').exec,
  common = require('../../agent/common'),
  logger = common.logger.prefix('DAEMON'),
  root_user = 'root',
  path_launch_daemon = '/Library/LaunchDaemons/',
  watcher_opts = {
    key: new_watcher_key,
    bin: join(`${paths.install}`, 'versions', 'prey-user'),
    user: root_user,
    interval: 1800, // check every half hour
    name: 'New Prey Owl',
  };

/*
 * verify current version of prey-user in order to update the watcher configuration and create it if is needed
 */
const trigger_set_watcher = (cb) => {
  exec(
    `test -f ${join(paths.current, 'bin', 'prey-user')} && echo exists`,
    (error, stdout) => {
      if (stdout) {
        exec(
          `${join(paths.current, 'bin', 'prey-user')} -v`,
          (error, prey_user_version) => {
            if (error) {
              return cb && cb(error);
            }
            console.log(`prey-user -v output: ${prey_user_version}`);
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
    exec(
      `test -f ${join(paths.install, 'prey-user')} && echo exists`,
      (_parent_error, parent_stdout) => {
        if (parent_stdout) {
          exec(
            `${join(paths.install, 'prey-user')} -v`,
            (error, prey_user_version) => {
              if (error) {
                reject(error);
              }
              resolve(prey_user_version);
            }
          );
        } else {
          exec(
            `test -f ${join(
              `${paths.install}`,
              'versions',
              'prey-user'
            )} && echo exists`,
            (_error, stdout) => {
              if (stdout) {
                exec(
                  `${join(`${paths.install}`, 'versions', 'prey-user')} -v`,
                  (child_error, prey_user_version) => {
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
  if (is_greater_or_equal(preyUserOldVersion, preyUserVersion)) {
    return cb && cb();
  }
  testExistingConfigurations(cb);
};

// check if exists the configuration of com.prey.owl.plist or com.prey.new_owl.plist
// when the com.prey.new_owl.plist is found verify if the old .plis still exists and it's removed
// and
const testExistingConfigurations = (cb) => {
  const newPath = path_launch_daemon + new_watcher_key + '.plist';
  const oldPath = path_launch_daemon + old_watcher_key + '.plist';

  exec(`test -f ${newPath} && echo exists`, (error, stdout) => {
    if (stdout) {
      // look for old .plist and remove it
      exec(`test -f ${oldPath} && echo exists`, (_error, _stdout) => {
        if (!_stdout) {
          return cb && cb(_error);
        }

        satan.ensure_destroyed(old_watcher_key);

        exec(`rm -fr ${join(`${paths.install}`, 'prey-user')}`, (err) => {
          return cb && cb(err);
        });
      });
      exec(`rm -fr ${join(`${install_versions_path}`, 'prey-user')}`, (err) => {
        console.log(`${err}`);
        exec(`/bin/cp ${current_path_prey_user} ${install_versions_path}`, (err2) => {
          console.log(`${err2}`);
        });
      });
    } else {
      activeWatcher(cb);
    }
  });
};

const activeWatcher = (cb) => {
  const source = join(paths.current, 'bin', 'prey-user');
  const destination = join(paths.install, 'versions');
  
  exec(`/bin/cp ${source} ${destination}`, () => {
    satan.ensure_created(watcher_opts, (err) => {
      if (err) return;
      // wait one sec, then start. or half.
      setTimeout(function () {
        satan.start(new_watcher_key, (_error) => {
          if (typeof cb === 'function')
            return cb && cb(_error);
          return;
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

exports.trigger_set_watcher = trigger_set_watcher;
exports.remove_watcher = remove_watcher;
