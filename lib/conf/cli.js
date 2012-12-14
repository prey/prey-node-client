#!/usr/bin/env node

var fs     = require('fs'),
    path   = require('path'),
    dialog = require('dialog'),
    common = require('./../common'),
    config = common.config,
    system = common.system,
    paths  = system.paths,
    hooks  = require('./' + common.os_name),
    ensure_dir = require('./../utils/ensure_dir'),
    gen_keys = require('./../utils/keygen'),
    versions_list;

var argv = process.argv.splice(3),
    Operetta = require('./../utils/operetta').Operetta,
    cli = new Operetta(argv);

var package  = require('./package'),
    versions = require('./versions'),
    remote   = require('./remote'),
    messages = require('./messages'),
    helpers  = require('./helpers'),
    prompt   = require('./prompt'),
    settings = require('./settings');

var debugging = process.env.DEBUG;

var debug = function(str) {
  if (debugging) console.log(str);
}

////////////////////////////////////////////////
// ensure stuff
////////////////////////////////////////////////

// syncs config with the one of the current installation
ensure_config = function(cb){
  config.sync(common.default_config_file, cb);
}

// make sure keys are there
ensure_keys = function(cb){

  var key_paths = {
    private_key: path.join(paths.config, config.get('private_key')),
    certificate: path.join(paths.config, config.get('certificate'))
  };

  fs.exists(key_paths.private_key, function(exists){
    if (exists) return cb();
    gen_keys(key_paths, cb);
  });

}

ensure_logfile = function(cb){
  fs.writeFile(paths.log_file, '', cb);
}

////////////////////////////////////////////////
// main functions
////////////////////////////////////////////////

// sets up config and keys, and if all goes well,
// sets version as the active/current one
var set_up_version = function(version, cb){
  set_up_config(function(err){
    if (err) return cb(err);

    if (!paths.versions) // no version support
      return cb();

    console.log('Setting up ' + version + ' as current...');
    versions.set_current(version, cb)
  })
}

var unset_current = function(cb){
  versions.unset_current(function(err){
    var e = err.code == 'ENOENT' ? null : e;
    cb(e); // skip error if not exists
  });
}

var set_up_config = function(cb){

  console.log('Ensuring presence of config dir: ' + paths.config);
  ensure_dir(paths.config, function(err){
    if (err) return cb(err);

    console.log('Syncing config with ' + common.default_config_file);
    ensure_config(function(err){
      if (err) return cb(err);

      console.log('Ensuring SSL keys...');
      ensure_keys(cb);
    });

  });

}

// runs pre_uninstall on current installation, then
// calls prey config activate on the new installation,
// so that it performs the activation using its own paths
// if it fails, then remove it.

var activate_new_version = function(version, cb){

  run_pre_uninstall(function(err){
    if (err) {
      console.log('Error: ' + err.message.trim());
      console.log('Pre-uninstall on this version failed. Rolling back.');
      return versions.remove(version, cb);
    }

    var version_bin = path.join(paths.versions, version, paths.prey_bin);

    helpers.run_synced(version_bin, ['config', 'activate'], function(err){
      if (!err) return cb();

      console.log('Failed. Rolling back!');

      // something went wrong while upgrading. remove new package & undo pre_uninstall
      versions.remove(version, function(er){
      	run_post_install(function(e){
          cb(e || er || err);
      	});
      });

    });

  });

}

// sets up crontab or delay in registry
// and then calls os post install hook
// to set up trigger / system service
var run_post_install = function(cb){
  system.set_interval(60, function(err){
    if (err) return cb(err);

    hooks.post_install(cb);
  })
}

// removes crontab or delay in registry
// and then calls os pre uninstall hook
// to remove trigger / system service
var run_pre_uninstall = function(cb){
  system.unset_interval(function(err){
    if (err) return cb(err);

    hooks.pre_uninstall(cb);
  })
}

var check_installation = function(cb){

  // check that config file exists
  if (!settings.present())
    return cb(new Error('Config file not present!'))

  // check that prey bin exists
  if (!fs.existsSync(paths.bin_path))
    return cb(new Error('Prey bin not found in ' + paths.bin_path))

  // check account status
  var keys = config.get('control-panel'),
      opts = {api_key: keys.api_key, device_key: keys.device_key};

  if (!opts.api_key)
    return cb(new Error('API Key not found!'))
  else if (!opts.device_key)
    return cb(new Error('Device Key not found! Run Prey to register device.'))

  remote.verify(opts, function(err){
    if (err) return cb(err);

    cb();
    // check if execution method is set
    // hooks.post_install(cb);
  });

}

var show_gui_and_exit = function(){

  config.writable(function(can_write){

    if (!can_write) {
      dialog.warn('Config file not writable! Please run as system user.')
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
      args = [gui_path.replace('prey-config', 'PreyConfig.app')]
      gui_path = '/usr/bin/open';
    }

    helpers.run_detached(gui_path, args);

    process.nextTick(function(){
      console.log('Exitting...');
      process.exit(0);
    });

  })

}

////////////////////////////////////////////////
// command line arguments handler
////////////////////////////////////////////////

var run = function(cb) {

  // called after the files have been copied.
  // should be called from /usr/lib/prey/versions/1.5.2
  cli.command('activate', 'Completes installation, sets up config and execution.', function(cmd){
    cmd.options(['-g', '--gui'], 'Display GUI configurator when done.')
    cmd.start(function(values){

      var show_gui = values['-g'] === true;

      set_up_version('this', function(err){
        if (err) return cb(err);

        // if gui was requested but we had an error, return
        run_post_install(function(err){
          if (err || !show_gui) return cb(err);

          show_gui_and_exit();
        });
      });
    });
  });


  // called after the files have been copied.
  // should be called from /usr/lib/prey/versions/1.5.2
  cli.command('deactivate', 'Unsets execution and unlinks current version.', function(cmd){
    cmd.start(function(values){
      unset_current(function(err){
        if (err) return cb(err);
        run_pre_uninstall(cb);
      });
    });
  });

  run_pre_uninstall(cb);

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

        console.log('New version installed: ' + new_version);
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

        console.log('New version installed: ' + new_version);
        activate_new_version(new_version, cb);
      });

    });
  });

  // versions

  cli.command('versions', 'Manage versions', function(sub){

    sub.command('current', 'Returns current active (symlinked) version.', function(cmd){
      cmd.start(function(values){
        var curr = versions.current();
        if (curr) console.log(curr);
      });
    });

    sub.command('this', 'Returns local version from which script was called.', function(cmd){
      cmd.start(function(values){
        var ver = versions.this();
        if (ver) console.log(ver);
      });
    });

    sub.command('list', 'Shows list of installed versions.', function(cmd){
      cmd.start(function(values){
        var list = versions.list();
        if (list) console.log(list.join('\n'));
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

        console.log(settings.list());
      });
    });

    sub.command('get', 'Returns value for specified setting.', function(cmd){
      cmd.start(function(values){
        if (!settings.present())
          return cb(new Error('Config file not found!'))

        var key = values.positional[0];
        if (!key) return cb(new Error('Key required.'));

        var val = settings.get(key);
        console.log(val ? val : 'Not found.');
      });
    });

    sub.command('set', 'Updates setting in config file.', function(cmd){
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

    sub.start();

  });

  // account
  cli.command('account', 'Prey account management', function(sub){

    var panel = config.get('control-panel');

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

          // if (panel.api_key == '' && data.api_key)
          settings.set_api_key(data.api_key, function(err){
            cb(err, 'Credentials valid! Account configured.')
          })
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
            update = values['-u'] === true;

        if (current) {
          opts.api_key = panel.api_key;
          opts.device_key = panel.device_key;
        } else {
          opts.api_key = values['-a'];
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

        var data = helpers.verify({
          name:     values['-n'],
          email:    values['-e'],
          password: values['-p'],
          password_confirmation: values['-p'],
          country:  values['-c']
        });

		console.log(process.argv)

        remote.signup({ user: data }, function(err, data){
          if (err || !data.api_key)
            return cb(err || new Error('No API Key received.'));

          settings.set_api_key(data.api_key, function(err){
            cb(err, 'Account created! You can run Prey now.')
          });
        });
      });
    });

    sub.command('setup', 'Starts interactive command-line account setup.', function(cmd){
      cmd.options(['-f', '--force'], 'Force setup even if API key is already set.')
      cmd.start(function(values){

        var api_key   = config.get('control-panel').api_key,
            run_again = values['-f'] === true;

        if (api_key !== '' && !run_again)
          return cb(new Error('Account already set up! Run with --force if you want to continue anyway.'));

        prompt.start(function(err, data){
          if (err) return cb(err);

          console.log('Credentials verified.');
          settings.update('control-panel', {api_key: data.api_key}, function(err){
            cb(err, 'Credentials verified. You can run Prey now.')
          });
        });
      });
    });

    sub.start();

  })

  cli.command('check', 'Verifies that current installation is fine and dandy.', function(cmd){
    cmd.start(function(values){
      console.log('Checking installation.');
      check_installation(cb);
    });
  });

  cli.command('gui', 'Opens GUI configurator to set up account.', function(cmd){
    cmd.start(function(values){
      show_gui_and_exit();
    });
  });

  cli.command('run', 'Runs Prey. Registers device if API is set but no Device key.', function(cmd){
    cmd.start(function(values){
      helpers.run_synced(system.paths.prey_bin, [], cb);
    });
  });


  // cli.banner = "\n Prey Installation Manager - v" + common.version + "\n";
  cli.start();

}

run(function(err, message){

  if (err && err.code == 'EACCES')
    console.log(messages.no_perms);
  else
    console.log(err ? 'Error! ' + err.message : message || messages.exit_ok);

  process.exit(err ? 1 : 0);
})
