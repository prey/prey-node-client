#!/usr/bin/env node

/**
 * Prey Node Client
 *
 * Configuration
 * Command Line Interfase
 *
 */

// Set up Operetta (Command line parser)
var argv        = process.argv.splice(3),
    Operetta    = require('./../utils/operetta').Operetta,
    cli         = new Operetta(argv);

// Other dependencies
var common      = require('../common'),
    messages    = require('./messages'),
    return_err;

////////////////////////////////////////////////
// main function and auxiliars
////////////////////////////////////////////////

run(function (err, message) {
  return_err = err;

  if (err && err.code == 'EACCES')
    err.message = messages.no_perms;
  else if (err && err.toString().indexOf('hang up') != -1)
    err.message = messages.connection_timeout;

  log(err ? 'Error! ' + err.message : message || messages.exit_ok);
});

process.on('exit', function() {
  process.exit(return_err ? 1 : 0);
});

function log (msg) {
  if (typeof msg == 'object')
    msg = util.inspect(msg);

  if (process.stdout.writable)
    process.stdout.write(msg.toString() + "\n");
}

////////////////////////////////////////////////
// command line arguments handler
////////////////////////////////////////////////

function run (callback) {
  // Sync loading, since this assignation occurs once.
  // Please, note We are passing the variable `common` here.
  var cli_controller = require('./cli_controller')(log, common, callback);

  cli.command( 'activate'
             , 'Completes installation, sets up config and execution.'
             , function (cmd) {
    cmd.options(['-g', '--gui'], 'Display GUI configurator when done.');
    cmd.start(cli_controller.activate);
  });

  cli.command( 'deactivate'
             , 'Unsets execution and unlinks current version.'
             , function (cmd) {
    cmd.start(cli_controller.deactivate);
  });

  cli.command('hooks', 'Pre/post installation hooks.', function (sub) {
    sub.command('post_install', 'Runs post install OS hooks.', function (cmd) {
      cmd.start(cli_controller.hook_post_install);
    });

    sub.command('pre_uninstall', 'Runs pre uninstall OS hooks.', function (cmd) {
      cmd.start(cli_controller.hooks_pre_install);
    });
    sub.start();
  });

  cli.command('gui', 'Opens GUI configurator to set up account.', function (cmd) {
    cmd.start(cli_controller.show_gui_and_exit);
  });

  /*
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

  cli.command('check', 'Verifies that current installation is fine and dandy.', function(cmd){
    cmd.start(function(values){
      log('Checking installation.');
      check_installation(cb);
    });
  });

/*
  cli.command('run', 'Runs Prey. Registers device if API is set but no Device key.', function(cmd){
    cmd.start(function(values){
      run_agent(cb);
    });
  });
*/

  cli.banner = "\n Prey Installation Manager - v" + common.version + "\n";
  cli.start();
}
