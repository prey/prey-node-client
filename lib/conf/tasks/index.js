var fs         = require('fs'),
    async      = require('async'),
    shared     = require('./../shared'),
    common     = require('./../../common'),
    join       = require('path').join,
    paths      = common.system.paths,
    os_name    = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    chmod      = require('chela').chmod;

/////////////////////////////////////////////////////////////////
// local requires

var os_hooks  = require('./os/' + os_name),
    daemon    = require('./daemon'),
    prey_user = require('./prey_user');

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
    log('Syncing ' + common.config.path + ' with ' + common.default_config_file);
    common.config.sync(common.default_config_file, 'nonempty', cb);
  });
}

var chmod_version = function(version, cb) {
  chmod(join(paths.versions, version), '0755', cb);
};

var set_up_version = function(version, cb) {
  set_up_config(function(err) {
    if (err) return cb(err);

    if (!paths.versions) { // no version support, so cannot set version as current
      log('No versions support.');
      return os_hooks.post_activate(cb);
    }

    chmod_version(version, function(err) {
      if (err) return cb(err);

      log('Setting up ' + version + ' as current...');
      shared.version_manager.set_current(version, function(err){
        if (err) {
          if (err.code == 'ALREADY_CURRENT')
            log('Warning: This version is already set as current.');
          else
            return cb(err);
        }

        log('Version set. Running post_activate hooks.');
        // call post_activation hooks (e.g. firewall toggling in Windows)
        os_hooks.post_activate(cb);
      });
    });

  })
}

/////////////////////////////////////////////////////////////////
// exports: activate, post_install, pre_uninstall

exports.activate = function(values, cb) {
  set_up_version('this', cb);
}

exports.post_install = function(values, cb) {

  var ready = function(err) {
    if (err) return cb(err);

    log('Installing init scripts.');
    async.series([
      daemon.install,
      os_hooks.post_install
    ], function(err, res) {
      if (err) return cb(err);

      log('Sweet! Please run `prey config gui` to finish installation.');
      cb && cb();
    })
  }

  // on windows, there's no need to create a user or set up permissions
  // and activation is done in the same context, so we can skip all that.
  if (process.platform == 'win32') {
    return set_up_version('this', ready);
  }

  // ok, now create user, set up permissions, call 'activate' as prey user
  prey_user.create(ready);
}

exports.pre_uninstall = function(values, cb) {

  var argument = values['-u'] && values.positional[0],
      updating = argument == 'true' || parseInt(argument) === 1;

  var tasks = [
    daemon.remove,
    os_hooks.pre_uninstall
  ];

/*
  no need to notify plugins that they're being disabled.
  they won't be loaded anymore anyway.

  if (!updating) {
    tasks = [shared.plugin_manager.disable_all].concat(tasks);
  }
*/

  async.series(tasks, function(err, res) {
    cb(err); // don't return res, it's an array with undefines
  });

}
