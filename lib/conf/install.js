var fs         = require('fs'),
    join       = require('path').join,
    common     = require('./../common'),
    config     = require('../utils/configfile'),
    system     = common.system,
    package    = common.package,
    paths      = system.paths,
    run_synced = require('./utils/run_synced'),
    shared     = require('./shared');

// calls 'prey config activate' on the new installation,
// so that it performs the activation using its own paths and logic.
// if it fails, roll back by removing it
var activate_new_version = function(version, cb) {
  var version_path = join(paths.versions, version),
      opts         = { env: process.env, cwd: version_path },
      args         = ['config', 'activate'];

  opts.env.UPGRADING_FROM = common.version;

  if (process.platform == 'win32') {
    var bin  = join(version_path, 'bin', 'node.exe');
    args     = [join('lib', 'conf', 'cli.js')].concat(args);
  } else {
    var bin  = join(version_path, 'bin', paths.bin);
  }

  run_synced(bin, args, opts, function(err, code) {
    if (!err && code === 0) return cb();

    shared.log('Failed. Rolling back!');

    // something went wrong while upgrading.
    // remove new package & undo pre_uninstall
    shared.version_manager.remove(version, function(er) {
      cb(er || err);
    });
  });
}

// install local package into version path
exports.local = function(values, cb) {
  var file = values.file;
  if (!file) return cb(new Error('File path required.'));

  var destination = values['-d'] || paths.versions;

  package.install(file, destination, function(err, new_version) {
    if (err) return cb(err);

    shared.log('New version installed: ' + new_version);
    activate_new_version(new_version, cb);
  });
}

// checks and installs the latest version in repository, if newer.
exports.remote = function(values, cb) {

  var wants_version = values.version;
  var destination   = values['-d'] || paths.versions;

  var done = function(err, new_version) {
    if (err) return cb(err);

    shared.log('New version installed: ' + new_version);

    if (!process.env.RUNNING_USER)
      return activate_new_version(new_version, cb);

    // ok, we're running as a child process of the agent.
    // first we'll let them know we're good to go, by explicitly
    // writing to stdout which is where he's listening.

    // launchd's WatchPaths option seems to have a slight delay, so if the process
    // exits immediately after having copied the files, we'll get an immediate
    // restart which is not what we want. so wait a few seconds before telling our parent to die.
    setTimeout(function() {
      process.stdout.write('YOUARENOTMYFATHER');

      // ok, now the parent process should be shutting down.
      // we'll wait a few seconds before proceeding, to give it time to unload all plugins, etc.
      // the max unload time is 10 seconds so we'll wait a tiny bit further.
      setTimeout(function() {

        // if you haven't got tired of reading these comments, here's another one.
        // since now we've been detached from the parent process, it means that the
        // pipe to the parent's STDOUT and STDERR is no longer there. so we'll
        // reopen those streams to a temporary location so that we don't run into trouble.
        process.stdout = fs.openSync(system.tempfile_path('detached-out.log'), 'w');
        process.stderr = fs.openSync(system.tempfile_path('detached-err.log'), 'w');

        activate_new_version(new_version, cb)
      }, 11111);

    }, 2000);
  }

  // if version was requested, and not 'edge' or 'stable', then get it.
  if (wants_version && wants_version != 'edge' && wants_version != 'stable')
    return package.get_version(wants_version, destination, done);

  var latest_installed = shared.version_manager.latest();

  if (!latest_installed)
    return cb(new Error('Unable to determine latest installed version.'))

  // ok, either 'edge', 'stable' or nada was requested. let's check.
  var branch = wants_version == 'edge' ? 'edge' : 'stable';
  package.get_latest(branch, latest_installed, destination, done);
}

// ensures current installation is A-OK
exports.check = function(values, cb) {
  shared.log('Checking installation.');

  // if we have versions support, check if symlinked
  if (paths.versions && !fs.existsSync(paths.current))
    return cb(new Error('Current version not set in ' + paths.current))

  // check that prey bin exists
  if (!fs.existsSync(paths.current_bin))
    return cb(new Error('Prey bin not found in ' + paths.current_bin))

  shared.keys.verify_current(function(err) {
    if (!err)
      shared.log('Installation seems to be clean as a bean. Good job!')

    cb(err);
  });
}

exports.activate_new_version = activate_new_version;
