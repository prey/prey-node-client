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

  cli.command( 'activate',
               'Completes installation, sets up config and execution.',
               function (cmd) {
    cmd.options(['-g', '--gui'], 'Display GUI configurator when done.');
    cmd.start(cli_controller.activate);
  });

  cli.command( 'deactivate',
               'Unsets execution and unlinks current version.',
               function (cmd) {
    cmd.start(cli_controller.deactivate);
  });

  cli.command( 'hooks',
               'Pre/post installation hooks.',
               function (sub) {

    sub.command('post_install',
                'Runs post install OS hooks.',
                function (cmd) {
      cmd.start(cli_controller.hook_post_install);
    });

    sub.command('pre_uninstall',
                'Runs pre uninstall OS hooks.',
                function (cmd) {
      cmd.start(cli_controller.hook_pre_uninstall);
    });
    sub.start();
  });

  cli.command('gui',
              'Opens GUI configurator to set up account.',
              function (cmd) {
    cmd.start(cli_controller.show_gui_and_exit);
  });

  cli.command('account',
              'Prey account management',
              function (sub) {
    sub.command('authorize',
                'Validates auth credentials, and stores API key if authorized.',
                function (cmd) {
      cmd.parameters(['-e', '--email'], 'Email.');
      cmd.parameters(['-p', '--password'], 'Password.');
      cmd.start(cli_controller.account_authorize);
    });

    sub.command('verify',
                'Verifies API & Device keys, optionally saving them to config.',
                function (cmd) {
      cmd.parameters(['-a', '--api-key'], 'API Key.');
      cmd.parameters(['-d', '--device-key'], 'Device Key.');
      cmd.options(['-c', '--current'], 'Use current keys in config for verification.');
      cmd.options(['-u', '--update'], 'Stores keys in config, if valid. No effect with --current.');
      cmd.start(cli_controller.account_verify);
    });

    sub.command('signup',
                'Signs up for a new account on the Control Panel.',
                function (cmd) {
      cmd.parameters(['-n', '--name'], 'Name');
      cmd.parameters(['-e', '--email'], 'Email');
      cmd.parameters(['-p', '--password'], 'Password');
      cmd.parameters(['-c', '--country'], 'Country name');
      cmd.start(cli_controller.account_signup);
    });

    sub.command('setup',
                'Starts interactive command-line account setup.',
                function (cmd) {
      cmd.options(['-f', '--force'], 'Force setup even if API key is already set.');
      cmd.start(cli_controller.account_setup);
    });

    sub.start();
  });

  /*
   *  We run these commands if we have version support
   *  i.e. we have `common.system.paths.versions`
   */
  if (common.system && common.system.paths && common.system.paths.versions) {

    cli.command('install',
                'Installs specified ZIP package into installation path.',
                function (cmd) {
      cmd.parameters(['-f', '--file'], 'File to unpack into install path.');
      cmd.start(cli_controller.install);
    });

    cli.command('upgrade',
                'Downloads and installs a greater Prey version, if any.',
                function (cmd) {
      cmd.parameters(['-d', '--destination'], 'Destination path to install');
      cmd.start();
    });

    cli.command('versions',
                'Manage versions',
                function (sub) {

      sub.command('current',
                  'Returns current active (symlinked) version.',
                  function (cmd) {
        cmd.start(cli_controller.version_current);
      });

      sub.command('this',
                  'Returns local version from which script was called.',
                  function (cmd) {
        cmd.start(cli_controller.version_this);
      });

      sub.command('list',
                  'Shows list of installed versions.',
                  function (cmd) {
        cmd.start(cli_controller.version_list);
      });

      sub.command('set',
                  'Symlinks [version], setting it as the active one.',
                  function (cmd) {
        cmd.parameters(['-v', '--version'], 'Version to set as active.');
        cmd.start();
      });

      sub.start();
    });
  }

  cli.command('settings',
              'View or modify Prey settings',
              function (sub) {

    sub.command('list',
                'Shows all available settings in config file.',
                function (cmd) {
      cmd.start(cli_controller.settings_list);
    });

    sub.command('read',
                'Returns value for specified setting.',
                function (cmd) {
      cmd.start(cli_controller.settings_read);

    sub.command('update',
                'Updates setting in config file.',
                function (cmd) {
      cmd.start(cli_controller.settings_update);
    });

    sub.command('toggle',
                'Toggles boolean setting.',
                function (cmd) {
      cmd.start(cli_controller.settings_toggle);

    sub.start();
  });

  cli.command('check',
              'Verifies that current installation is fine and dandy.',
              function (cmd) {
    cmd.start(cli_controller.check);
  });

  cli.command('run',
              'Runs Prey. Registers device if API is set but no Device key.',
              function (cmd) {
    cmd.start(cli_controller.run);
  });

  cli.banner = "\n Prey Installation Manager - v" + common.version + "\n";
  cli.start();
}
