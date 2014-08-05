var fs         = require('fs'),
    common     = require('./../common'),
    config     = common.config,
    paths      = common.system.paths,
    package    = common.package,
    run_synced = require('./utils/run_synced'), 
    shared     = require('./shared');

var log = function(str) {
  shared.log(str);
}

// calls 'prey config activate' on the new installation,
// so that it performs the activation using its own paths and logic.
// if it fails, roll back by removing it
var activate_new_version = function(version, cb) {
  var version_bin = join(paths.versions, version, 'bin', paths.bin);

  var opts = { env: process.env };
  opts.env.UPGRADING_FROM = common.version;

  run_synced(version_bin, ['config', 'activate'], opts, function(err, code) {
    if (!err && code === 0) return cb();

    shared.log('Failed. Rolling back!');

    // something went wrong while upgrading.
    // remove new package & undo pre_uninstall
    shared.version_manager.remove(version, function(er){
      cb(er || err);
    });
  });
}

// install local package into version path
exports.local = function(values, cb) {
  var file = values.file;
  if (!file) return cb(new Error('File path required.'));

  var destination = values['-d'] || paths.versions;

  package.install(file, destination, function(err, new_version){
    if (err) return cb(err);

    shared.log('New version installed: ' + new_version);
    activate_new_version(new_version, cb);
  });
}

// checks and installs the latest version in repository, if newer.
exports.remote = function(values, cb) {

  var wants_version = values.version;
  var destination = values['-d'] || paths.versions;

  var done = function(err, new_version) {
    if (err) return cb(err);

    shared.log('New version installed: ' + new_version);
    if (process.env.RUNNING_USER) // run through agent
      shared.log('YOUARENOTMYFATHER');

    activate_new_version(new_version, cb);
  }

  if (wants_version && wants_version != 'latest')
    return package.get_version(wants_version, destination, done);

  var latest_installed = versions.latest();

  if (!latest_installed)
    return cb(new Error('Unable to determine latest installed version.'))

  package.get_latest(latest_installed, destination, done);

}

// ensures current installation is A-OK
exports.check = function(values, cb) {
  log('Checking installation.');

  // check that config file exists
  if (!config.present())
    return cb(new Error(messages.no_config))

  // if we have versions support, check if symlinked
  if (paths.versions && !fs.existsSync(paths.current))
    return cb(new Error('Current version not set in ' + paths.current))

  // check that prey bin exists
  if (!fs.existsSync(paths.current_bin))
    return cb(new Error('Prey bin not found in ' + paths.current_bin))

  shared.keys.verify_current(function(err) {
    if (!err)
      log('Installation seems to be clean as a bean. Good job!')

    cb(err);
  });
}