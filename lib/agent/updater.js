var join    = require('path').join,
    exists  = require('fs').exists,
    common  = require('./common'),
    logger  = common.logger,
    system  = common.system,
    child_process = require('child_process'); // need to use child_process for stubbing to work in test

var no_versions_support_error = function() {
  var err = new Error('No versions support.');
  err.code = 'NO_VERSIONS_SUPPORT';
  return err;
}

var update_client = function(version, cb){

  var child,
      out = [],
      prey_bin      = system.paths.package_bin,
      versions_path = system.paths.versions;

  var let_the_child_go = function() {
    child.unref();
    process.nextTick(function() {
      process.exit(33); // non zero code so the agent is respawned
    })
  }

  // ok, so the whole deal here is to run the upgrade task from a separate process
  // so that, if successful, we can detach from the running agent process (this one).
  // the key is running this separate process from the package's bin path, no the
  // current (symlinked) one. that way we don't run into race conditions and/or EACCESS errors.

  var opts = {
    detached: true,
    env  : process.env, // make sure the RUNNING_USER env var is passed
    stdio: [ 'ignore', 'pipe', 'ignore' ] // stdin no, stdout yes, stderr no
  }

  logger.warn('Starting upgrade process!');
  child = child_process.spawn(prey_bin, ['config', 'upgrade'], opts);

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
    exists(join(versions_path, version), function(exists) {
      if (exists) return cb && cb();

      var err = new Error('Update to ' + version + ' failed.');
      err.stack = out.join('\n');
      return cb && cb(err);
    });
  });
}

exports.check = function(cb){
  if (!system.paths.versions)
    return cb && cb(no_versions_support_error());

  common.package.new_version_available(common.version, function(err, version) {
    if (err || !version)
      return cb && cb(new Error('Upgrade failed: ' + err.message));

    update_client(version, cb);
  })
};
