var fs = require('fs'),
  async = require('async'),
  shared = require('./../shared'),
  common = require('./../../common'),
  paths = common.system.paths,
  os_name = process.platform
    .replace('win32', 'windows')
    .replace('darwin', 'mac'),
  is_mac = os_name == 'mac',
  chmodr = require('chmodr'),
  prey_owl = require('./prey_owl'),
  api = require('./../../agent/plugins/control-panel/api');

/////////////////////////////////////////////////////////////////
// local requires

exports.chmodr = chmodr;

var os_hooks = require('./os/' + os_name),
  daemon = require('./daemon'),
  prey_user = require('./prey_user');

/////////////////////////////////////////////////////////////////
// helpers

var log = function (str) {
  shared.log(str);
};

var ensure_dir = function (dir, cb) {
  fs.existsSync(dir, function (exists) {
    if (exists) return cb();
    fs.mkdir(dir, cb);
  });
};

var set_up_config = function (cb) {
  // If /etc/prey or C:\Windows\Prey doesn't exist, create it.
  // Normally this path should be created by the installer
  log('Ensuring presence of config dir: ' + paths.config);
  ensure_dir(paths.config, function (err) {
    if (err) return cb(err);

    // Copy or sync [prey_path]/prey.conf.default to [config_path]/prey.conf
    log(
      'Syncing ' + common.config.path + ' with ' + common.default_config_file
    );
    common.config.sync(common.default_config_file, 'nonempty', cb);
  });
};

var set_up_version = function (version, cb) {
  function finish() {
    // first, ensure that /current path is readable by non-prey users
    // so that impersonated commands within path work as expected.
    log('Setting permissions on ' + paths.current);
    exports.chmodr(paths.current, 0o755, function (err) {
      if (err) return cb(err);

      // call post_activation hooks (e.g. firewall toggling in Windows)
      log('Running post_activate hooks...');
      os_hooks.post_activate(cb);
    });
  }

  set_up_config(function (err) {
    if (err) return cb(err);

    if (!paths.versions) {
      // no version support, so cannot set version as current
      log('No versions support.');
      return finish();
    }

    log('Setting up ' + version + ' as current...');
    shared.version_manager.set_current(version, function (err) {
      if (err) {
        if (err.code == 'ALREADY_CURRENT')
          log('Warning: This version is already set as current.');
        else return cb(err);
      }

      finish();
    });
  });
};

/////////////////////////////////////////////////////////////////
// exports: activate, post_install, pre_uninstall

exports.activate = function (values, cb) {
  set_up_version('this', cb);
};

exports.post_install = function (values, cb) {
  var ready = function (err) {
    if (err) return cb(err);

    var tasks = [daemon.install, os_hooks.post_install];

    log('Installing init scripts.');
    async.series(tasks, function (err) {
      if (err) return cb(err);

      var finished = function () {
        log(
          'Sweet! Please run `prey config panel` or `prey config gui` to link your device.'
        );
        return cb && cb();
      };
      // After the installation success create prey user watcher (on mac's)
      if (is_mac) daemon.set_watcher(finished);
      else finished();
    });
  };

  // on windows, there's no need to create a user or set up permissions
  // and activation is done in the same context, so we can skip all that.
  if (process.platform == 'win32') {
    return set_up_version('this', ready);
  }

  // ok, now create user, set up permissions, call 'activate' as prey user
  prey_user.create(ready);
};

exports.pre_uninstall = function (values, cb) {
  var argument = values['-u'] && values.positional[0],
    updating = argument == 'true' || parseInt(argument) === 1;

  var tasks = [daemon.remove, os_hooks.pre_uninstall];

  // Insert at the beginning of tasks the mac watcher remover
  if (is_mac) tasks.unshift(prey_owl.remove_watcher);

  /*
  no need to notify plugins that they're being disabled.
  they won't be loaded anymore anyway.

  if (!updating) {
    tasks = [shared.plugin_manager.disable_all].concat(tasks);
  }
*/

  if (!updating) {
    let api_key = shared.keys.get().api,
      device_key = shared.keys.get().device;

    if (api_key && device_key) {
      api.keys.set({ api: api_key, device: device_key });
      api.push['event']({ name: 'uninstalled' }, { json: true });
    }
  }

  async.series(tasks, function (err) {
    cb(err); // don't return res, it's an array with undefines
  });
};
