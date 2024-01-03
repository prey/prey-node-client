const { eq } = require('semver');
const { join } = require('path');
const exists = require('fs').existsSync;

const needle = require('needle');
const os = require('os');
const childProcess = require('child_process');
const common = require('./common');

const logger = common.logger.prefix('updater');
const { system } = common;

const { exec } = childProcess;

const config = require('../utils/configfile');

const patternMajorMinorPatch = /^\d+(\.\d+){2}$/;

const host = 'https://127.0.0.1:7739';
const updatingHost = `${host}/updating`;

let timer; let
  timer2; // for interval check
exports.upgrading = false;
exports.check_enabled = true;

const no_versions_support_error = function () {
  const err = new Error('No versions support.');
  err.code = 'NO_VERSIONS_SUPPORT';
  return err;
};

const update_client = function (new_version, cb) {
  let child;
  let error;
  const out = [];
  const versions_path = system.paths.versions;

  // on windows, the package_bin would open the prey.cmd file which will spawn
  // an instance of cmd.exe, which means the stdout will not be piped to this process
  // so we need to call the node.exe binary directly for this to work.
  if (process.platform == 'win32') {
    var bin_path = join(system.paths.package, 'bin', 'node.exe');
    var args = [join('lib', 'conf', 'cli.js'), 'config', 'upgrade', new_version];
  } else {
    var bin_path = system.paths.package_bin; // /foo/bar/bin/prey
    var args = ['config', 'upgrade', new_version];
  }

  exports.upgrading = true;

  const let_the_child_go = function () {
    child.unref();
    process.nextTick(() => {
      // exit with a zero code so the agent isn't respawned immediately
      // on windows and linux the daemon with wait 15 seconds, and in
      // osx (given that launchd doesn't support that option) it will
      // restart when changes are detected on the install path (from 'config activate')
      process.exit(0);
    });
  };

  // ok, so the whole deal here is to run the upgrade task from a separate process
  // so that, if successful, we can detach from the running agent process (this one).
  // the key is running this separate process from the package's bin path, no the
  // current (symlinked) one. that way we don't run into race conditions and/or EACCESS errors.

  const opts = {
    detached: true,
    env: process.env, // make sure the RUNNING_USER env var is passed
    cwd: system.paths.package,
    stdio: ['ignore', 'pipe', 'pipe'], // stdin no, stdout yes, stderr yes
  };

  logger.warn('Starting upgrade process. Hold on tight!');
  child = childProcess.spawn(bin_path, args, opts);

  child.stderr.on('data', (data) => {
    logger.error(data.toString());
  });

  child.stdout.on('data', (data) => {
    out.push(data);
    data.toString().trim().split('\n').forEach((line) => {
      const timeout = process.platform == 'darwin' ? 0 : 15000;
      // if the child succeeded, then it will print this in its stdout stream
      // that means it's time to let him go on his own, and complete his purpose in life.
      if (line.match('YOUARENOTMYFATHER')) {
        // Keep the process alive for a while in the case we get an error.
        setTimeout(() => {
          if (!error) {
            logger.warn('Upgrade successful! See you in another lifetime, young one.');
            exports.upgrading = false;
            let_the_child_go();
          }
        }, timeout);
      } else if (line.includes('Error')) {
        logger.warn(line);

        if (error) return;
        error = line;
        // Notify error and stop upgrade process
        common.package.update_version_attempt(common.version, new_version, false, true, error, (err) => {
          if (err) logger.warn('Unable to notify the update error');
          exports.upgrading = false;
        });
      } else {
        logger.info(line.trim());
      }
    });
  });

  child.on('exit', (code) => {
    const existsNewVersion = exists(join(versions_path, new_version));
    exports.upgrading = false;

    if (existsNewVersion && cb && typeof cb === 'function') return cb && cb(new Error('Version already installed'));
    let err;
    if (code != 0) err = new Error(`Upgrade to ${new_version} failed. Exit code: ${code}`);

    if (!cb || typeof cb !== 'function') {
      if (err) logger.warn(err);
      return;
    }

    err.stack = out.join('\n');
    return cb && cb(err);
  });
};

/**
 * Verify if winsvc must be updated
 * @param {object} cb - a callback function
 */
exports.check_for_update_winsvc = (cb) => {
  /** Skip this block if OS is not windows. */
  if (os.platform() != 'win32') { return cb(new Error('Action only allowed on Windows')); }

  const updater_path = join(system.paths.package, 'bin', 'updater.exe');
  const sys_win = require('../system/windows');
  /** Get the current version of winsvc running on the device. */
  // eslint-disable-next-line consistent-return
  sys_win.get_winsvc_version((err, current_service_version) => {
    if (!patternMajorMinorPatch.test(current_service_version)) return cb(new Error('WinSVC version doesnt have the correct format'));
    if (err) return cb(new Error('Error to get winsvc version'));

    if (!current_service_version) {
      return cb(new Error('Error to get current winsvc version.'));
    }

    /** Get the latest version of winsvc. */
    // eslint-disable-next-line consistent-return
    exports.get_stable_version_winsvc((err, service_version_stable) => {
      if (!patternMajorMinorPatch.test(service_version_stable)) return cb(new Error('WinSVC stable version doesnt have the correct format'));
      if (err) return cb(new Error('Error to get stable version'));

      logger.notice(`New version found winsvc: ${service_version_stable}`);

      /** check if device is running the latest version. */
      if (service_version_stable && eq(current_service_version, service_version_stable)) {
        logger.notice(`Nothing to do. latest version already installed. ${service_version_stable}`);
        return cb(null, true);
      }

      /** Perform the update. */
      exports.update_winsvc(`${updater_path} -v=${current_service_version}`, (err_update) => {
        if (err_update) { return cb(new Error(`error to update winsvc,${err_update.message}`)); }

        return cb(null, true);
      });
    });
  });
};

const check_for_update = function (cb) {
  config.load(() => {
    if (!exports.check_enabled || exports.upgrading) {
      if (cb && typeof cb === 'function') return cb();
      return;
    }

    exports.check_enabled = false;

    const versions_path = system.paths.versions;
    const branch = config.getData('download_edge') == true ? 'edge' : 'stable';

    logger.debug(`Checking for updates on ${branch} branch...`);
    common.package.new_version_available(branch, common.version, (err, new_version) => {
      if (err || !new_version) {
        common.package.check_update_success(common.version, versions_path, (err) => cb && cb(err || new Error('Theres no new version available')));
      } else {
        needle.put(updatingHost, null, { timeout: 4500 }, () => {
          logger.notice(`New version found: ${new_version}`);
          update_client(new_version, cb);
        });
      }
    });

    exports.check_for_update_winsvc((err, is_updated) => {
      if (err) logger.info(err.message);
      if (is_updated) logger.info('winsvc updated ');
    });
  });
};

exports.check = function (id, target, opts, cb) {
  function done(err) {
    if (cb && typeof cb === 'function') return cb && cb(err);
  }

  if (!target) {
    logger.warn('No target for upgrade command found');
    return;
  }

  if (!system.paths.versions) {
    logger.warn(no_versions_support_error().message);
    return done(no_versions_support_error());
  }

  switch (target) {
    case 'reset':
      // Command forces auto-update even if we're out of attempts
      exports.check_enabled = true;
      if (exports.upgrading) logger.warn('Already running upgrade process.');

      common.package.delete_attempts((err) => {
        if (err) { logger.error(err); }

        check_for_update((err) => {
          done(err);
        });
      });
      break;

    case 'activate':
      // activate new version and reset client
      if (!opts || !opts.version) {
        logger.warn('Missing client version to activate');
        return done();
      }

      logger.info(`Activating version ${opts.version}`);
      common.package.activate_version(opts.version);
      done();
      break;

    case 'delete':
      // delete new version
      if (!opts || !opts.version) {
        logger.warn('Missing client version to delete');
        return done();
      }
      logger.info(`Deleting version ${opts.version}`);
      common.package.delete_version(opts.version);
      break;

    case 'restart':
      // restart client
      logger.info('Restarting client');
      common.package.restart_client();
      done();
      break;

    case 'update-winsvc':
      // update winsvc
      logger.info('command updating winsvc');
      exports.check_for_update_winsvc((err, is_updated) => {
        if (err) logger.info(err.message);
        if (is_updated) logger.info('winsvc updated from command');
        done();
      });
      break;

    default:
      logger.warn('Invalid target for upgrade command');
      done();
      break;
  }
};

exports.check_every = function (interval, cb) {
  if (!system.paths.versions) { return cb && cb(no_versions_support_error()); }

  timer = setInterval(() => {
    exports.check_enabled = true;
    exports.upgrading = false;
  }, interval);
  timer2 = setInterval(check_for_update, 5 * 60 * 60 * 1000); // backup update check
};

exports.stop_checking = function () {
  if (timer) clearInterval(timer);
  if (timer2) clearInterval(timer2);
  timer = null;
  timer2 = null;
};

exports.update_winsvc = (path, cb) => {
  exec(path, (err, pid) => {
    logger.info(`executing service windows update!${path}`);
    if (err) return cb(err);
    return cb(null, pid);
  });
};

exports.get_stable_version_winsvc = function (cb) {
  config.load(() => {
    const releases_host = 'https://downloads.preyproject.com';
    const releases_url = `${releases_host}/prey-client-releases/winsvc/`;
    const latest_text = 'latest.txt';

    const key = config.getData('control-panel.device_key').toString() || null;
    const options = {
      headers: { 'resource-dk': key },
    };
    needle.get(releases_url + latest_text, key ? options : null, (err, resp, body) => {
      const ver = body && body.toString().trim();
      cb(err, ver);
    });
  });
};

exports.check_for_update = check_for_update;
exports.logger = logger;
