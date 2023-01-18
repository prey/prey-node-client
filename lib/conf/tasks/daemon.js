var fs = require('fs'),
    satan = require('satan'),
    join = require('path').join,
    is_greater = require('compare-versions'),
    is_greater_or_equal = require('../../agent/helpers').is_greater_or_equal,
    system = require('./../../system'),
    paths = require('./../../system/paths'),
    exec = require('child_process').exec,
    os_name = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    common = require('../../agent/common'),
    logger = common.logger.prefix('DAEMON'),
    storage = require('../../agent/utils/storage'),
    is_windows = process.platform == 'win32';
var bin_path = join(paths.current, 'bin'),
    prey_user = 'prey',
    root_user = 'root',
    greater = -1,
    vers_err = null;
var run = function (cmd, cb) {
    exec(cmd, cb)
}
const old_watcher_key = 'com.prey.owl';
var watcher_opts = {
    key: 'com.prey.new_owl',
    bin: join(`${paths.install}`, 'versions', 'prey-user'),
    user: root_user,
    interval: 120,   // check every hour
    name: 'New Prey Owl'
}

if (is_windows) {
    var exe_name = 'wpxsvc.exe',
        old_exe_name = 'wpxsvc_old.exe',
        service_bin = join(paths.current, 'lib', 'system', 'windows', 'bin', exe_name),
        service_bin_old = join(paths.current, 'lib', 'system', 'windows', 'bin', old_exe_name),
        service_run_path = join(paths.install, exe_name);
    var daemon_opts = {
        bin: service_run_path,
        // path : paths.current,
        key: 'CronService',
        name: 'Cron Service',
        desc: 'Streamlines the execution of commands based on a system schedule.',
        daemon_path: null
    }
} else {
    var daemon_opts = {
        key: process.platform == 'linux' ? 'prey-agent' : 'com.prey.agent',
        path: paths.current,
        bin: paths.current_bin,
        user: prey_user,
        name: 'Prey'
    }
    if (process.platform == 'linux') {
        // upstart init script needs to make it explicit that it isn't running on a terminal
        // and we also need to set the USER var so that system.get_running_user() works as expected.
        daemon_opts.env = { 'TERM': 'dumb', 'USER': prey_user };
        // upstart: start on startup and when exited with code 0, but only if not shutting down
        daemon_opts.up_start_on = 'startup or (stopped prey-agent EXIT_STATUS=0 and runlevel [2345])';
        // upstart: sleep 15 seconds after stopped, before restarting (e.g. when not stopped by upstart itself)
        daemon_opts.up_pre_stop_script = 'echo "1" > /tmp/stopped-${JOB}';
        daemon_opts.up_post_stop_script = '[ ! -f "/tmp/stopped-${JOB}" ] && sleep 15\n rm -f /tmp/stopped-${JOB}';
        // tell systemd to wait 15 seconds before restarting.
        // use sd_ prefix so we don't insert this into upstart scripts.
        daemon_opts.sd_respawn_wait = 15;
        // and lastly, tell systemd not to kill detached processes when the daemon stops.
        // this happens when using the default 'control-group' kill mode behaviour.
        daemon_opts.sd_kill_mode = 'process';
    } else { // osx
        // tell launchd to restart script whenever a change is detected in install dir
        daemon_opts.watch_paths = [paths.install];
        // in case the process exits with status code != 0 in less than 10 secs,
        // ensure that the respawn will wait.
        // NOTE: not using it anymore, codes != 0 should be restarted immediately
        // daemon_opts.respawn_wait = 15;
    }
}
exports.install = function (cb) {
    var next = function (err) {
        // EBUSY error is when file is being run. that shouldn't happen normally
        // but for the purposes of setting up the daemon, it doesn't really matter.
        if (err && err.code !== 'EBUSY') return cb(err);
        // satan ensures the daemon is destroyed before creating
        // a new one, so there's no need to perform that check now.
        satan.ensure_created(daemon_opts, function (err) {
            if (err) return cb(err);
            // wait one sec, then start. or half.
            setTimeout(function () {
                satan.start(daemon_opts.key, cb);
            }, 500);
        });
    }
    if (is_windows) {
        run('chcp 65001', function () {
            system.get_os_version(function (err, os_version) {
                try { greater = is_greater(os_version, '6.2'); }
                catch (e) { vers_err = e; }
                if (err || vers_err || greater == -1)
                    service_bin = service_bin_old;
                fs.copyFile(service_bin, service_run_path, next);
            })
        });
    } else {
        next();
    }
}

exports.remove = function (cb) {
    satan.ensure_destroyed(daemon_opts.key, function (err) {
        if (err || !is_windows) return cb(err);
        fs.unlink(service_run_path, function (err) {
            // if (err) return cb(err);
            cb(); // don't mind if it wasn't there.
        });
    });
}

exports.set_watcher = (cb) => {
    exec(`test -f ${join(paths.current, 'bin', 'prey-user')} && echo exists`, (error, stdout) => {
        if (stdout){
            exec(`${join(paths.current, 'bin', 'prey-user')} -v`, (error, prey_user_version) => {
                console.log("\n" + 'began');
                if (error) {
                    console.log('Error call -v prey-user: ' + error);
                    return cb && cb(error);
                }
                console.log(`prey-user -v output: ${prey_user_version}`);
                queryStorage(prey_user_version, cb);
            });
        } else {
            return cb && cb(error);
        }
    });
}

const queryStorage = (preyUserVersion, cb) => {
    exec(`test -f ${join(paths.install, 'prey-user')} && echo exists`, (error, stdout) => {
        if (stdout) {
            exec(`${join(paths.install, 'prey-user')} -v`, (error, prey_user_version) => {
                if (error || !prey_user_version) {
                    exec(`${join(`${paths.install}`, 'versions', 'prey-user')} -v`, (_error, _prey_user_version) => {
                        compareVersionsDaemon(_prey_user_version, preyUserVersion, cb);
                    });
                } else compareVersionsDaemon(prey_user_version, preyUserVersion, cb);
            });
        } else {
            exec(`test -f ${join(`${paths.install}`, 'versions', 'prey-user')} && echo exists`, (error, stdout) => {
                if (stdout) {
                    exec(`${join(`${paths.install}`, 'versions', 'prey-user')} -v`, (_error, _prey_user_version) => {
                        compareVersionsDaemon(_prey_user_version, preyUserVersion, cb);
                    });
                } else {
                    compareVersionsDaemon(null, preyUserVersion, cb);
                }
            });
        }
    });
};

const compareVersionsDaemon = (preyUserOldVersion, preyUserVersion, cb) => {
    console.log("\n" + 'OLD VERSION: ' + preyUserOldVersion + '\nNEW VERSION: ' + preyUserVersion);
    if (preyUserVersion) {
        if (preyUserOldVersion && is_greater_or_equal(preyUserOldVersion, preyUserVersion)) {
            console.log(`prey-user -v output: ${preyUserVersion}`);
            logger.info(preyUserOldVersion + ' >= ' + preyUserVersion);
            return cb && cb();
        }
        updatePreyUserVersion(preyUserVersion);
    }
    testExistingConfigurations(cb);
};

const testExistingConfigurations = (cb) => {
    exec('test -f /Library/LaunchDaemons/com.prey.new_owl.plist && echo exists', (error, stdout) => {
        if (stdout) {
            console.log("\n" + 'SI existe la configuracion de /Library/LaunchDaemons/com.prey.new_owl.plist');
            exec('test -f /Library/LaunchDaemons/com.prey.owl.plist && echo exists', (_error, _stdout) => {
                if (_stdout) {
                    console.log("\n" + 'SI existe la configuracion de /Library/LaunchDaemons/com.prey.owl.plist');
                    remove_watcher_by_key(old_watcher_key);
                    activeWatcher(true, cb);
                }else {
                    return cb && cb (_error);
                }
            });
        } else {
            console.log("\n" + 'NO existe la configuracion de /Library/LaunchDaemons/com.prey.new_owl.plist');
            activeWatcher(false, cb);
        }
    });
};

const activeWatcher = (existingConfig, cb) => {
    if (existingConfig) {
        run(`rm -fr /usr/local/lib/prey/prey-user`, (err) => {
            console.log("\n" + 'Se removio prey-user actual maybe (?): ' + err);
            return cb && cb(err);
        });
    } else {
        run(`/bin/cp ${join(paths.current, 'bin', 'prey-user')} ${paths.install}/versions/`, () => {
            satan.ensure_created(watcher_opts, (err2) => {
                //console.log("\n" + `CREATING ${JSON.stringify(watcher_opts)} (?):` + err2);
                if (err2) return;
                // wait one sec, then start. or half.
                setTimeout(function () {
                    satan.start(watcher_opts.key, (_error) => {
                        console.log("\n" + 'Creation :(! ): ' + _error);
                    });
                }, 500);
            });
        });
    }
}

const updatePreyUserVersion = (preyUserVersion) => {
    storage.do('update', { type: 'keys', id: 'prey_user_version', columns: 'value', values: preyUserVersion }, (err) => {
        if (err) return;
    });
};


const remove_watcher_by_key = function (key) {
    console.log("\nremove_watcher_by_key");
    satan.ensure_destroyed(key, function (err) {
        console.log("\nensure_destroyed\nAl destruir by key" + key + " : " + err);
    });
};

exports.remove_watcher = function (cb) {
    satan.ensure_destroyed(watcher_opts.key, function (err) {
        satan.ensure_destroyed(old_watcher_key, (error) => {
            console.log("\nAl destruir en general: " + err);
            return cb && cb(error);
        });
    });
}