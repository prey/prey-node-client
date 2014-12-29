var join    = require('path').join,
    exists  = require('fs').exists,
    common  = require('./common'),
    logger  = common.logger.prefix('updater'),
    system  = common.system,
    child_process = require('child_process'); // need to use child_process for stubbing to work in test

var timer; // for interval check

var no_versions_support_error = function() {
  var err = new Error('No versions support.');
  err.code = 'NO_VERSIONS_SUPPORT';
  return err;
}

var update_client = function(new_version, cb) {

  var child,
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

      // if the child succeeded, then it will print this in its stdout stream
      // that means it's time to let him go on his own, and complete his purpose in life.
      if (line.match('YOUARENOTMYFATHER')) {
        logger.warn('Upgrade successful! See you in another lifetime, young one.');
        let_the_child_go();
      } else {
        logger.info(line.trim());
      }

    })
  })

  child.on('exit', function(code) {
    exists(join(versions_path, new_version), function(exists) {
      if (exists) return cb && cb();

      var err = new Error('Upgrade to ' + new_version + ' failed. Exit code: ' + code);
      err.stack = out.join('\n');
      return cb && cb(err);
    });
  });
}

var check_for_update = function(cb) {
  var branch = common.config.get('download_edge') == true ? 'edge' : 'stable';

  logger.debug('Checking for updates on ' + branch + ' branch...');
  common.package.new_version_available(branch, common.version, function(err, new_version) {
    if (err || !new_version)
      return cb && cb(err);

    logger.notice('New version found: ' + new_version);
    update_client(new_version, cb);
  })
}

exports.check = function(cb){
  if (!system.paths.versions)
    return cb && cb(no_versions_support_error());

  check_for_update(cb);
};

exports.check_every = function(interval, cb) {
  if (!system.paths.versions)
    return cb && cb(no_versions_support_error());

  var interval = interval || 60 * 60 * 1000; // one hour by default
  timer = setInterval(check_for_update, interval); 
}

exports.stop_checking = function() {
  if (timer) clearInterval(timer);
  timer = null;
}