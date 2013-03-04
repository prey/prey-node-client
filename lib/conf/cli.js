#!/usr/bin/env node

var fs          = require('fs'),
    util        = require('util'),
    path        = require('path'),
    dialog      = require('dialog'),
    common      = require('./../common'),
    config      = common.config,
    system      = common.system,
    paths       = system.paths,
    hooks       = require('./' + common.os_name),
    os_name     = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    versions_list;

// Set up Operetta (Command line parser)
var argv      = process.argv.splice(3),
    Operetta  = require('./../utils/operetta').Operetta,
    cli       = new Operetta(argv);

var package  = require('./package'),
    versions = require('./versions'),
    remote   = require('./remote'),
    messages = require('./messages'),
    helpers  = require('./helpers'),
    prompt   = require('./prompt'),
    settings = require('./settings');

////////////////////////////////////////////////
// logger functions
////////////////////////////////////////////////

// Debug logger
var debugging = process.env.DEBUG
  , debug     = function (msg) {
  if (debugging) log(msg);
}

// Normal logger
var log = function (msg) {
  if (typeof msg == 'object')
    msg = util.inspect(msg);

  if (process.stdout.writable)
    process.stdout.write(msg.toString() + "\n");
}

////////////////////////////////////////////////
// module main functions
////////////////////////////////////////////////

/**
 *
 * Sets up config and keys, and if all goes well,
 * sets version as the active/current one
 *
 */
var setUpVersion = function (version, cb) {
  setUpConfig(isSetConfig);
  // If /etc/prey or C:\Windows\Prey doesn't exist, create it.
  //  Normally this path should be created by the installer
  function setUpConfig () {
    log('Ensuring presence of config dir: ' + paths.config);
    ensureDir(paths.config, ensuredDir);
  }

  function ensureDir (dirPath, callback) {
    fs.exists(dirPath, function(exists) {
      if (exists) return callback();
      return fs.mkdir(dirPath, callback);
    });
  }

  function ensuredDir (err) {
    // An error here is likely to happen if we run this not being root
    if (err) return cb(err);
    // Copy or sync ROOT_PATH/prey.conf.default to /etc/prey/prey.conf
    log('Syncing config with ' + common.default_config_file);
    config.sync(common.default_config_file, isSetConfig);
  }

  function isSetConfig (err){
    if (err) return cb(err);
    // If we haven't version support (i.e. couldn't find `versions` dir),
    // just return, we already synced.
    if (!paths.versions) return cb();
    // Create symlink to set as current version
    log('Setting up ' + version + ' as current...');
    versions.set_current(version, cb);
  }
}

var unset_current = function(cb){
  versions.unset_current(function(err){
    var e = err && err.code == 'ENOENT' ? null : err;
    cb(e); // skip error if not exists
  });
}

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

// set api key and run agent
var set_api_key_and_run = function(key, cb){
  settings.set_api_key(key, function(err){
    if (err) return cb(err);
    run_agent(cb);
  })
}

// run agent in the foreground and wait to finish. agent/cli.js will exit with
// a status code 10 if another instance is already running.
var run_agent = function(cb){
  helpers.run_synced(system.paths.package_bin, [], function(code){
    if (code == 10)
      cb(new Error('Code 10 returned. Agent seems to be running already.'));
    else
      cb (code !== 0 && new Error('Error while running agent.'));
  });
}

var show_gui_and_exit = function(){

  config.writable(function(can_write){

    if (!can_write) {
      log('Config file not writable!');
      dialog.warn('Config file not writable! Please run as system/root user.')
      return process.exit(1);
    }

    var args = [],
        os_name = system.os_name,
        gui_path = path.join(__dirname, os_name, 'prey-config');

    if (os_name == 'windows')
      gui_path = gui_path + '.exe';
    else if (os_name == 'linux')
      gui_path = gui_path + '.py';
    else {
      args = [gui_path.replace('prey-config', 'PreyConfig.app/Contents/MacOS/prey-config.rb')]
      gui_path = '/usr/bin/ruby';
    }

    helpers.run_detached(gui_path, args);

    process.nextTick(function(){
      log('Exitting...');
      process.exit(0);
    });

  })

}

////////////////////////////////////////////////
// command line arguments handler
////////////////////////////////////////////////

var run = function (cb) {

  /**
   * @map     [./bin/prey] config activate [-g]
   *
   * @summary Called after the files have been copied.
   *          should be called from /usr/lib/prey/versions/1.5.2
   */
  cli.command( 'activate'
             , 'Completes installation, sets up config and execution.', function (cmd) {
    cmd.options(['-g', '--gui'], 'Display GUI configurator when done.');
    cmd.start(function (values) {
      if (process.env.BUNDLE_ONLY) return cb();

      var show_gui = values['-g'] === true;

      setUpVersion('this', isSetVersion);

      function isSetVersion (err) {
        if (err) return cb(err);
        // if gui was requested but we had an error, return
        system.set_interval(60, isSetInterval);
      }

      function isSetInterval (err){
        if (err || !show_gui) return cb(err);
        show_gui_and_exit();
      }
    });
  });

  // called after the files have been copied.
  // should be called from /usr/lib/prey/versions/1.5.2
  cli.command('deactivate', 'Unsets execution and unlinks current version.', function(cmd){
    cmd.start(function(values){
      system.unset_interval(function(err){
        if (err) return cb(err);
        unset_current(cb);
      })
    });
  });

  // if there is no version path, where do we install other versions?
  if (paths.versions) {

  // packages, install or update

  cli.command('install', 'Installs specified ZIP package into installation path.', function(cmd){
    cmd.parameters(['-f', '--file'], 'File to unpack into install path.');
    cmd.start(function(values){
      var file = values['-f'];
      if (!file) return cb(new Error('File path required.'));

      var destination = values['-d'] || paths.install;

      package.install(file, destination, function(err, new_version){
        if (err) return cb(err);

        log('New version installed: ' + new_version);
        activate_new_version(new_version, cb);
      });
    });
  });

  // fetches the latest package from the releases repo
  // if install goes through
  // should be called from /usr/lib/prey/versions/1.5.2
  cli.command('upgrade', 'Downloads and installs greater Prey version, if any.', function(cmd){
    cmd.start(function(values){

      var latest_installed = versions.latest(),
          destination = values['-d'] || paths.versions;

      if (!latest_installed)
        return cb(new Error('Unable to determine latest installed version.'))

      package.get_latest(latest_installed, destination, function(err, new_version){
        if (err) return cb(err);

        log('New version installed: ' + new_version);
        if (process.env.RUNNING_USER) // run through agent
          log('YOUARENOTMYFATHER');

        activate_new_version(new_version, cb);
      });

    });
  });

  // versions

  cli.command('versions', 'Manage versions', function(sub){

    sub.command('current', 'Returns current active (symlinked) version.', function(cmd){
      cmd.start(function(values){
        var curr = versions.current();
        if (curr) log(curr);
      });
    });

    sub.command('this', 'Returns local version from which script was called.', function(cmd){
      cmd.start(function(values){
        var ver = versions.this();
        if (ver) log(ver);
      });
    });

    sub.command('list', 'Shows list of installed versions.', function(cmd){
      cmd.start(function(values){
        var list = versions.list();
        if (list) log(list.join('\n'));
      });
    });

    sub.command('set', 'Symlinks [version], setting it as the active one.', function(cmd){
      cmd.parameters(['-v', '--version'], 'Version to set as active.')
      cmd.start(function(values){
        var version = values['-v'];
        if (!version) return cb(new Error('Version not passed.'));

//        versions.set_current(version || 'this', cb);
        versions.set_current(version, cb);
      });
    });

    sub.start();

  });

  }

  cli.command('settings', 'View or modify Prey settings', function(sub){

    sub.command('list', 'Shows all available settings in config file.', function(cmd){
      cmd.start(function(){
        if (!settings.present())
          return cb(new Error('Config file not found!'))

        log(settings.list());
      });
    });

    sub.command('read', 'Returns value for specified setting.', function(cmd){
      cmd.start(function(values){
        if (!settings.present())
          return cb(new Error('Config file not found!'))

        var key = values.positional[0];
        if (!key) return cb(new Error('Key required.'));

        var val = settings.get(key);
        log(typeof val != 'undefined' ? val : 'Not found.');
      });
    });

    sub.command('update', 'Updates setting in config file.', function(cmd){
      cmd.start(function(values){
        if (!settings.present())
          return cb(new Error('Config file not found!'))

        var key = values.positional[0],
            val = values.positional[1];
            val2 = values.positional[2];

        if (!val) return cb(new Error('Please provide a value.'))

        if (val2) {
          subkey = val;
          val = {}
          val[subkey] = val2;
        }

        settings.update(key, val, cb);
      });
    });

    sub.command('toggle', 'Toggles boolean setting.', function(cmd){
      cmd.start(function(values){
        if (!settings.present())
          return cb(new Error('Config file not found!'))

        var key = values.positional[0];
        if (!key) return cb(new Error('Key required.'));

        var val = settings.get(key);
        if (typeof val != 'boolean')
          return cb(new Error(key + ' is not boolean.'));

        settings.update(key, !val, function(err){
          cb(err, key + ' toggled: ' + val.toString() + ' -> ' + (!val).toString())
        })
      });
    });

    sub.start();

  });

  // account
  cli.command('account', 'Prey account management', function(sub){

    sub.command('authorize', 'Validates auth credentials, and stores API key if authorized.', function(cmd){
      cmd.parameters(['-a', '--api-key'], 'API Key.')
      cmd.parameters(['-e', '--email'], 'Email.')
      cmd.parameters(['-p', '--password'], 'Password.')
      cmd.start(function(values){

        var opts = {
          api_key:  values['-a'],
          email:    values['-e'],
          password: values['-p']
        };

        remote.authorize(opts, function(err, data){
          if (err || !data.api_key)
            return cb(err || new Error('Unable to authorize.'));

          log('Credentials valid!');
          // if (panel.api_key == '' && data.api_key)
          set_api_key_and_run(data.api_key, cb);
        });
      });
    });

    sub.command('verify', 'Verifies API & Device keys, optionally saving them to config.', function(cmd){
      cmd.parameters(['-a', '--api-key'], 'API Key.')
      cmd.parameters(['-d', '--device-key'], 'Device Key.')
      cmd.options(['-c', '--current'], 'Use current keys in config for verification.')
      cmd.options(['-u', '--update'], 'Stores keys in config, if valid. No effect with --current.')
      cmd.start(function(values){

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

        remote.verify(opts, function(err){
          if (err || current || !update) return cb(err);

          settings.set_keys(opts, cb);
        });
      });
    });

    sub.command('signup', 'Signs up for a new account on the Control Panel.', function(cmd){
      cmd.parameters(['-n', '--name'], 'Name')
      cmd.parameters(['-e', '--email'], 'Email')
      cmd.parameters(['-p', '--password'], 'Password')
      cmd.parameters(['-c', '--country'], 'Country name')
      cmd.start(function(values){

        if (is_api_key_set())
          return cb(new Error('Account already set up!'));

        var data = helpers.verify({
          name:     values['-n'],
          email:    values['-e'],
          password: values['-p'],
          password_confirmation: values['-p'],
          country:  values['-c']
        });

        remote.signup({ user: data }, function(err, data){
          if (err || !data.api_key)
            return cb(err || new Error('No API Key received.'));

          log('Account created!');
          set_api_key_and_run(data.api_key, cb);
        });
      });
    });

    sub.command('setup', 'Starts interactive command-line account setup.', function(cmd){
      cmd.options(['-f', '--force'], 'Force setup even if API key is already set.')
      cmd.start(function(values){

        var run_again = values['-f'] === true;

        if (is_api_key_set() && !run_again)
          return cb(new Error('Account already set up! Run with --force if you want to continue anyway.'));

        config.writable(function(can_write){
          if (!can_write)
            return cb(new Error('Config file not writable! Please run as system/root user.'))

          prompt.start(function(err, data){
            if (err) return cb(err);

            log('Credentials verified.');
            set_api_key_and_run(data.api_key, cb);
          });
        });
      });
    });

    sub.start();

  })

  cli.command('hooks', 'Pre/post installation hooks.', function(sub){

    sub.command('post_install', 'Runs post install OS hooks.', function(cmd){
      cmd.start(function(){
        hooks.post_install(cb);
      });
    });

    sub.command('pre_uninstall', 'Runs pre uninstall OS hooks.', function(cmd){
      cmd.start(function(){
        hooks.pre_uninstall(cb);
      });
    });

    sub.start();

  });

  cli.command('check', 'Verifies that current installation is fine and dandy.', function(cmd){
    cmd.start(function(values){
      log('Checking installation.');
      check_installation(cb);
    });
  });

  cli.command('gui', 'Opens GUI configurator to set up account.', function(cmd){
    cmd.start(function(values){
      show_gui_and_exit();
    });
  });

/*
  cli.command('run', 'Runs Prey. Registers device if API is set but no Device key.', function(cmd){
    cmd.start(function(values){
      run_agent(cb);
    });
  });
*/

  // cli.banner = "\n Prey Installation Manager - v" + common.version + "\n";
  cli.start();

}

var return_err;

run(function(err, message){

  return_err = err;

  if (err && err.code == 'EACCES')
    err.message = messages.no_perms;
  else if (err && err.toString().indexOf('hang up') != -1)
    err.message = messages.connection_timeout;

  log(err ? 'Error! ' + err.message : message || messages.exit_ok);

})

process.on('exit', function() {
  process.exit(return_err ? 1 : 0);
});
