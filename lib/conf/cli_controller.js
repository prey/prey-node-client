/**
 * Prey Node Client
 *
 * Configuration
 * CLI controllers
 *
 * - Command Handlers
 * - Controller Functions
 *
 */

// Module dependencies and variables
var fs          = require('fs'),
    util        = require('util'),
    path        = require('path'),
    dialog      = require('dialog'),
    common,
    config,
    hooks,
    system,
    paths,
    versions_list;

var package     = require('./package'),
    versions    = require('./versions'),
    remote      = require('./remote'),
    helpers     = require('./helpers'),
    prompt      = require('./prompt'),
    settings    = require('./settings');

// Module constructor
var controller  = {},
    callback,
    log;

module.exports  = function (_log, _common, _callback) {
  callback = _callback;
  common   = _common;
  log      = _log;

  config   = common.config;
  hooks    = require('./' + common.os_name);
  system   = common.system;
  paths    = system.paths;

  return controller;
}

////////////////////////////////////////////////
/**
  Module command handlers

  `callback` is a module global variable, use it to return messages
  form the command line interfase.

  #callback(err, message)

*/
////////////////////////////////////////////////

/**
 * @map     [./bin/prey] config activate [-g]
 *
 * @summary Called after the files have been copied.
 *          Sets `current` link and system interval
 *
 * @api     public
 */
controller.activate = function (values) {
  if (process.env.BUNDLE_ONLY) return callback();

  var show_gui = values['-g'] === true;

  set_up_version('this', is_set_version);

  function is_set_version (err) {
    if (err) return callback(err);
    system.set_interval(60, is_set_interval);
  }

  function is_set_interval (err) {
    // if gui was requested but we had an error, return.
    if (err || !show_gui) return callback(err);
    controller.show_gui_and_exit();
  }
}

/**
 * @map     [./bin/prey] config deactivate
 *
 * @summary Called after the files have been copied.
 *          Deletes interval & symlink
 *
 * @api     public
 */
controller.deactivate = function (q) {
  system.unset_interval(interval_unset);

  function interval_unset (err) {
    if (err) return callback(err);
    // Delete symlink
    versions.unset_current(symlink_unset);
  }

  function symlink_unset (err) {
    var e = err && err.code == 'ENOENT' ? null : err;
    callback(e);
  }
}

/**
 * @map     [./bin/prey] config hooks post_install
 *
 * @summary Runs post install OS hooks
 *
 * @api     public
 */
controller.hook_post_install = function () {
  hooks.post_install(callback);
}

/**
 * @map     [./bin/prey] config hooks pre_uninstall
 *
 * @summary Runs pre uninstall OS hooks
 *
 * @api     public
 */
controller.hook_pre_uninstall = function () {
  hooks.pre_uninstall(callback);
}

/**
 * @summary Based on the system the machine is running
 *          it shows the GUI and exits
 *
 * @api     public
 */
controller.show_gui_and_exit = function () {
  config.writable(checkedWrite);

  function checkedWrite (can_write) {
    if (!can_write) {
      log('Config file not writable!');
      dialog.warn('Config file not writable! Please run as system/root user.')
      return process.exit(1);
    }

    var args      = [],
        os_name   = system.os_name,
        gui_path  = path.join(__dirname, os_name, 'prey-config');

    if (os_name == 'windows')
      gui_path = gui_path + '.exe';
    else if (os_name == 'linux')
      gui_path = gui_path + '.py';
    else {
      args = [gui_path.replace('prey-config', 'PreyConfig.app/Contents/MacOS/prey-config.rb')]
      gui_path = '/usr/bin/ruby';
    }

    helpers.run_detached(gui_path, args);

    process.nextTick(onNextTick);
  }

  function onNextTick () {
    log('Exiting...');
    process.exit(0);
  }
}

/**
 * @summary   Gets API key from Control panel with email/password.
 *            Sets the API Key into the configuration.
 *            Runs the agent (or exits if it is already running).
 *
 * @api       public
 */
controller.account_authorize = function (values) {
  var opts = {
    email     : values['-e'],
    password  : values['-p']
  }

  remote.authorize(opts, auth_response);

  function auth_response (err, data) {
    if (err || !data.api_key)
      return callback(err || new Error('Unable to authorize.'));
    log('Credentials valid!');
    settings.set_api_key(data.api_key, api_key_is_set);
  }

  function api_key_is_set (err) {
    if (err) return callback(err);
    // Run agent in the foreground and wait to finish. agent/cli.js will exit with
    // a status code 10 if another instance is already running.
    helpers.run_synced(system.paths.package_bin, [], function(code){
      if (code == 10)
        callback(new Error('Code 10 returned. Agent seems to be running already.'));
      else
        callback(code !== 0 && new Error('Error while running agent.'));
    });
  }
}

/**
 * @summary   Verify and/or updates pair api/device key
 *
 * @api       public
 */
controller.account_verify = function (values) {
  var opts = {},
      current = values['-c'] === true,
      update  = values['-u'] === true;

  if (current) {
    opts.api_key    = config.get('api_key');
    opts.device_key = config.get('device_key');
  } else {
    opts.api_key    = values['-a'];
    opts.device_key = values['-d'];
  }

  remote.verify(opts, verified);

  function verified (err) {
    if (err || current || !update) return callback(err);
    settings.set_keys(opts, callback);
  }
}

////////////////////////////////////////////////
// module functions
////////////////////////////////////////////////

/**
 * @param   {String}    version
 * @param   {Callback}  cb
 *
 * @summary Sets up config and keys, and if all goes well,
 *          sets version as the active/current one
 *
 * @api     private
 */
function set_up_version (version, cb) {
  set_up_config();
  // If /etc/prey or C:\Windows\Prey does not exist, create it.
  // Normally this path should be created by the installer
  function set_up_config () {
    log('Ensuring presence of config dir: ' + paths.config);
    ensure_dir(paths.config);
  }

  function ensure_dir (dir_path) {
    fs.exists(dir_path, function (exists) {
      if (exists) return ensured_dir();
      return fs.mkdir(dir_path, ensured_dir);
    });
  }

  function ensured_dir (err) {
    // An error here is likely to happen if we run this not being root
    if (err) return cb(err);
    // Copy or sync ROOT_PATH/prey.conf.default to /etc/prey/prey.conf
    log('Syncing config with ' + common.default_config_file);
    config.sync(common.default_config_file, is_set_config);
  }

  function is_set_config (err) {
    if (err) return cb(err);
    // If we don't have version support
    // (i.e. couldn't find `versions` dir),
    // just return, we already synced.
    if (!paths.versions) return cb();
    // Create symlink to set as current version
    log('Setting up ' + version + ' as current...');
    versions.set_current(version, cb);
  }
}

/*
// runs pre_uninstall on current installation, then
// calls 'prey config activate' on the new installation,
// so that it performs the activation using its own paths and logic.
// if it fails, roll back by removing it and setting interval again.
var activate_new_version = function(version, cb){

  system.unset_interval(function(err){
    if (err) {
      log('Error: ' + err.message.trim());
      log('Pre-uninstall on this version failed. Rolling back.');
      return versions.remove(version, cb);
    }

    var version_bin = path.join(paths.versions, version, 'bin', paths.bin);

    helpers.run_synced(version_bin, ['config', 'activate'], function(err){
      if (!err) return cb();

      log('Failed. Rolling back!');

      // something went wrong while upgrading.
      // remove new package & undo pre_uninstall
      versions.remove(version, function(er){
        system.set_interval(60, function(e){
          cb(e || er || err);
        });
      });

    });

  });

}



var check_installation = function(cb){

  // check that config file exists
  if (!settings.present())
    return cb(new Error('Config file not present!'))

  // if we have versions support, check if symlinked
  if (paths.versions && !fs.existsSync(paths.current))
    return cb(new Error('Current version not set in ' + paths.current))

  // check that prey bin exists
  if (!fs.existsSync(paths.current_bin))
    return cb(new Error('Prey bin not found in ' + paths.current_bin))

  // check account status
  var keys = {api_key: config.get('api_key'), device_key: config.get('device_key')};

  if (!keys.api_key || keys.api_key == '')
    return cb(new Error('API Key not found!'))
  else if (!keys.device_key || keys.device_key == '')
    return cb(new Error('Device Key not found! Run Prey to register device.'))

  remote.verify(keys, function(err){
    if (err) return cb(err);

    cb();
    // check if execution method is set
    // hooks.post_install(cb);
  });

}

// returns false if api is empty
var is_api_key_set = function(){
  var key = config.get('api_key');
  return key && key !== '';
}


*/
