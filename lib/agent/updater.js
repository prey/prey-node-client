var join    = require('path').join,
    exists  = require('fs').exists,
    common  = require('./common'),
    logger  = common.logger.prefix('updater'),
    system  = common.system,
    child_process = require('child_process'); // need to use child_process for stubbing to work in test

var timer, timer2; // for interval check
exports.upgrading = false;
exports.check_enabled = true;

var no_versions_support_error = function() {
  var err = new Error('No versions support.');
  err.code = 'NO_VERSIONS_SUPPORT';
  return err;
}

var update_client = function(new_version, cb) {

  var child,
      error,
      out = [],
      versions_path = system.paths.versions;

  // on windows, the package_bin would open the prey.cmd file which will spawn
  // an instance of cmd.exe, which means the stdout will not be piped to this process
  // so we need to call the node.exe binary directly for this to work.
  if (process.platform == 'win32') {
    var bin_path    = join(system.paths.package, 'bin', 'node.exe');
    var args        = [join('lib', 'conf', 'cli.js'), 'config', 'upgrade', new_version];
  } else {
    var bin_path    = system.paths.package_bin; // /foo/bar/bin/prey
    var args        = ['config', 'upgrade', new_version];
  }
  exports.upgrading = true;

  var let_the_child_go = function() {
    child.unref();
    process.nextTick(function() {
      // exit with a zero code so the agent isn't respawned immediately
      // on windows and linux the daemon with wait 15 seconds, and in
      // osx (given that launchd doesn't support that option) it will
      // restart when changes are detected on the install path (from 'config activate')
      process.exit(0);
    })
  }

  // ok, so the whole deal here is to run the upgrade task from a separate process
  // so that, if successful, we can detach from the running agent process (this one).
  // the key is running this separate process from the package's bin path, no the
  // current (symlinked) one. that way we don't run into race conditions and/or EACCESS errors.

  var opts = {
    detached : true,
    env      : process.env, // make sure the RUNNING_USER env var is passed
    cwd      : system.paths.package,
    stdio    : [ 'ignore', 'pipe', 'pipe' ] // stdin no, stdout yes, stderr yes
  }

  logger.warn('Starting upgrade process. Hold on tight!');
  child = child_process.spawn(bin_path, args, opts);

  child.stderr.on('data', function(data) {
    logger.error(data.toString());
  })

  child.stdout.on('data', function(data) {
    out.push(data);
    data.toString().trim().split('\n').forEach(function(line) {
      var timeout = process.platform == 'darwin' ? 0 : 15000;
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
        }, timeout)
      } else if (line.includes("Error")) {
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

    })
  })

  child.on('exit', function(code) {
    exists(join(versions_path, new_version), function(exists) {
      exports.upgrading = false;

      if (exists && cb && typeof cb == 'function') return cb && cb(new Error("Version already installed"));
      var err;
      if (code != 0) err = new Error('Upgrade to ' + new_version + ' failed. Exit code: ' + code);

      if (!cb || typeof cb != 'function') {
        if (err) logger.warn(err);
        return;
      }

      err.stack = out.join('\n');
      return cb && cb(err);
    });
  });
}

var check_for_update = function(cb) {
  if (!exports.check_enabled || exports.upgrading) {
    if (cb && typeof cb == 'function') return cb();
    else return;
  }

  exports.check_enabled = false;

  var versions_path = system.paths.versions,
      branch = common.config.get('download_edge') == true ? 'edge' : 'stable';

  logger.debug('Checking for updates on ' + branch + ' branch...');
  common.package.new_version_available(branch, common.version, function(err, new_version) {
    if (err || !new_version) {
      common.package.check_update_success(common.version, versions_path, function(err) {
        return cb && cb(err || new Error('Theres no new version available'));
      })
    } else {
      logger.notice('New version found: ' + new_version);
      update_client(new_version, cb);
    }
  })
}

exports.check = function(id, target, opts, cb) {
  function done(err) {
    if (cb && typeof cb === "function")
      return cb && cb(err);
    else return;
  }

  if (!target) {
    logger.warn("No target for upgrade command found");
    return;
  }

  if (!system.paths.versions) {
    logger.warn(no_versions_support_error().message);
    return done(no_versions_support_error());
  }

  switch (target) {
    case "reset":
      // Command forces auto-update even if we're out of attempts
      exports.check_enabled = true;
      if (exports.upgrading) logger.warn('Already running upgrade process.')

      common.package.delete_attempts((err) => {
        last_time = null;
        check_for_update((err) => {
          done(err);
        });
      });
      break;

    case "activate":
      // activate new version and reset client
      if (!opts || !opts.version) {
        logger.warn("Missing client version to activate");
        return done();
      }

      logger.info("Activating version " + opts.version);
      common.package.activate_version(opts.version);
      done();
      break;

    case "delete":
      // delete new version
      if (!opts || !opts.version) {
        logger.warn("Missing client version to delete");
        return done();
      }
      logger.info("Deleting version " + opts.version);
      common.package.delete_version(opts.version);
      break;

    case "restart":
      // restart client
      logger.info("Restarting client");
      common.package.restart_client();
      done();
      break;

    default:
      logger.warn("Invalid target for upgrade command")
      done();
      break;
  }
};

exports.check_every = function(interval, cb) {
  if (!system.paths.versions)
    return cb && cb(no_versions_support_error());

  var interval = interval || 3 * 60 * 60 * 1000; // three hours by default
  timer = setInterval(() => {
    exports.check_enabled = true;
    exports.upgrading = false;
  }, interval);
  timer2 = setInterval(check_for_update, 5 * 60 * 60* 1000); // backup update check
}

exports.stop_checking = function() {
  if (timer) clearInterval(timer);
  if (timer2) clearInterval(timer2);
  timer = null;
  timer2 = null;
}

exports.check_for_update = check_for_update;
exports.logger = logger;