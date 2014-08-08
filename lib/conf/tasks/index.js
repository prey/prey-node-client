var fs         = require('fs'),
    dialog     = require('dialog'),
    async      = require('async'),
    shared     = require('./../shared'),
    common     = require('./../../common'),
    config     = common.config,
    paths      = common.system.paths,
    os_name    = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    is_windows = os_name === 'windows';

/////////////////////////////////////////////////////////////////
// local requires

var os_hooks  = require('./os/' + os_name),
    daemon    = require('./daemon'),
    prey_user = require('./prey_user'),
    gui       = require('../gui');

/////////////////////////////////////////////////////////////////
// helpers

var log = function(str) {
  shared.log(str);
}

var ensure_dir = function(dir, cb) {
  fs.exists(dir, function(exists) {
    if (exists) return cb();
    fs.mkdir(dir, cb);
  });
}

var set_up_config = function(cb) {
  // If /etc/prey or C:\Windows\Prey doesn't exist, create it.
  // Normally this path should be created by the installer
  log('Ensuring presence of config dir: ' + paths.config);
  ensure_dir(paths.config, function(err) {
    if (err) return cb(err);

    // Copy or sync [prey_path]/prey.conf.default to [config_path]/prey.conf
    log('Syncing config with ' + common.default_config_file);
    config.sync(common.default_config_file, 'nonempty', cb);
  });
}

var set_up_version = function(version, cb) {
  set_up_config(function(err) {
    if (err) return cb(err);

    if (!paths.versions) // no version support, so cannot set version as current
      return cb();

    log('Setting up ' + version + ' as current...');
    shared.version_manager.set_current(version, function(err){
      if (err) return cb(err);

      log('Version set. Running post_activate hooks.');
      // call post_activation hooks (e.g. firewall toggling in Windows)
      os_hooks.post_activate(cb);
    });
  })
}

/////////////////////////////////////////////////////////////////
// exports: activate, post_install, pre_uninstall

exports.activate = function(values, cb) {
  var show_gui = values['-g'] === true;

  set_up_version('this', function(err) {
    if (err) {
      // if we had an error and GUI was requested, display a dialog before returning
      if (show_gui) dialog.warn(err.message);
      return cb(err);
    }

    if (!show_gui)
      return cb();

    gui.show_and_exit({}, cb);
  });
}

exports.post_install = function(values, cb) {

  var ready = function(err) {
    if (err && !err.message.match('already set as current')) 
      return cb(err);

    async.series([
      daemon.install,
      os_hooks.post_install
    ], function(err, res) {
      if (err) return cb(err);

      log('Sweet! Please run `prey config gui` to finish installation.');
    })
  }

  // on windows, there's no need to create a user or set up permissions
  // and activation is done in the same context, so we can skip all that.
  if (is_windows) {
    return set_up_version('this', ready);
  } 

  // ok, now create user, set up permissions, call 'activate' as prey user
  prey_user.create(ready); 
}

exports.pre_uninstall = function(values, cb) {

  async.series([
    shared.plugin_manager.disable_all,
    daemon.remove,
    os_hooks.pre_uninstall
  ], function(err, res) {
    cb(err); // don't return res, it's an array with undefines
  });

}