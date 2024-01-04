/////////////////////////////////////////////////////////////
// Prey Node.js Client Config Module
// Written by Tomás Pollak & Herman Yunge
// (c) 2013, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
/////////////////////////////////////////////////////////////

// this is run as part of the npm install command when bundling
// so we set an ENV var to retrain this little bugger from continuing.
if (process.env.BUNDLE_ONLY)
  return process.exit();

// base stuff
var common      = require('./../common'),
    shared      = require('./shared'),
    daemon      = require('./tasks/daemon'),
    config      = require('../utils/configfile'),
    system      = common.system,
    paths       = system.paths,
    exceptions  = common.exceptions,
    messages    = shared.messages;

// fix stdout flushing error on windows
// https://github.com/joyent/node/issues/3584
require('clean-exit');

// forward all logging from agent modules into prey-config.log
var logfile   = 'prey-config-' + Date.now() + '.log';
common.program.logfile = system.tempfile_path(logfile);

var argv      = process.argv.splice(3),
    Operetta  = require('./utils/operetta').Operetta,
    cli       = new Operetta(argv, 'config');

var account   = require('./account'),
    install   = require('./install'),
    versions  = require('./versions'),
    settings  = require('./settings'),
    tasks     = require('./tasks'),
    log       = require('./log'),
    gui       = require('./gui'),
    panel     = require('./panel');

// returns true if running via npm (run/install/remove)
var via_npm   = function() {
  return !!(process.env.npm_package_version || process.env.npm_lifecycle_script);
}

var start = function(cb) {
  config.load(() => {
    var run = function(scope, command) {
      scope.start(function(values) {
        command(values, cb);
      })
    }
  
    var run_if_writable = function(scope, command) {
      run(scope, command);
    }
  
    // account
    cli.command('account', 'Prey account management.', function(sub) {
  
      sub.command('authorize', 'Validates auth credentials, and stores API key if authorized.', function(cmd) {
        cmd.parameters(['-a', '--api-key'], 'API Key')
        cmd.parameters(['-e', '--email'], 'Email')
        cmd.parameters(['-p', '--password'], 'Password')
        run_if_writable(cmd, account.authorize);
      });
  
      sub.command('verify', 'Verifies API & Device keys, optionally saving them to config.', function(cmd) {
        cmd.parameters(['-a', '--api-key'], 'API Key')
        cmd.parameters(['-d', '--device-key'], 'Device Key')
        cmd.options(['-c', '--current'], 'Use current keys in config for verification.')
        cmd.options(['-u', '--update'], 'Stores keys in config, if valid. No effect with --current.')
        run(cmd, account.verify);
      });
  
      sub.command('signup', 'Signs up for a new Prey account.', function(cmd) {
        cmd.parameters(['-n', '--name'], 'Name')
        cmd.parameters(['-e', '--email'], 'Email')
        cmd.parameters(['-p', '--password'], 'Password')
        cmd.parameters(['-t', '--terms'], 'Accept terms & conditions and privacy policy (yes or y)')
        cmd.parameters(['-a', '--age'], 'Declare 16 or older (yes or y)')
        cmd.parameters(['-c', '--country'], 'Country Name')
        run_if_writable(cmd, account.signup);
      });
  
      sub.start();
    })
  
    // if there is no version path, where do we install other versions?
    if (paths.versions) {
  
    // packages, install or update
  
    cli.command('install', 'Installs specified ZIP package into installation path.', function(cmd) {
      cmd.keyword('file', 'File to unpack into install path.');
      run(cmd, install.local);
    });
  
    // fetches the latest package from the releases repo
    // if install goes through
    cli.command('upgrade', 'Checks, downloads and installs greater Prey version, if found.', function(cmd) {
      cmd.keyword('version', "Either X.Y.Z, 'edge' or 'stable'. Defaults to latest from stable.");
      run(cmd, install.remote);
    });
  
    // versions
  
    cli.command('versions', 'Manage installed versions.', function(sub){
  
      sub.command('current', 'Prints current active (symlinked) version.', function(cmd) {
        run(cmd, versions.current);
      });
  
      sub.command('this', 'Prints local version from which script was called.', function(cmd) {
        run(cmd, versions.this);
      });
  
      sub.command('list', 'Shows list of installed versions.', function(cmd) {
        run(cmd, versions.list);
      });
  
      sub.command('set', 'Symlinks [version], setting it as the active one.', function(cmd) {
        cmd.keyword('version', 'Version to set as active.');
        run(cmd, versions.set);
      });
  
      sub.start();
    });
  
    }
  
    // called during the upgrade process, after the files have been copied.
    // or during the post_install logic on Mac/Linux (as the prey user).
    // this command should never be run as root, otherwise we'll run into trouble
    // later because of permissions (e.g. not being able to upgrade versions or modify the config.)
    cli.command('activate', 'Ensures config file is up to date, and sets this as the current version.', function(cmd) {
      // the UPGRADING_FROM check shouldn't be necessary, but we'll keep it as a reference.
      // if (!opts.env.UPGRADING_FROM && process.getuid && process.getuid() === 0)
      if (process.getuid && process.getuid() === 0)
        return cb(new Error('This command should be run as the prey user.'));
  
      run(cmd, tasks.activate);
    });
  
    cli.command('hooks', 'Pre/post installation hooks.', function(sub) {
  
      sub.command('post_install', 'Runs post installation hooks.', function(cmd) {
        if (process.getuid && process.getuid() !== 0) {
          var line = new Array(80).join('=');
          var msg  = '\n  You are running this script as an unprivileged user';
              msg += '\n  so we cannot finalize setting up the client.';
              msg += '\n  To continue with the install process please run:\n';
              msg += '\n  $ sudo prey config hooks post_install\n';
  
          shared.log(line + msg + line);
          return process.exit(0); // no error, otherwise npm install fails
        }
  
        run(cmd, tasks.post_install);
      });
  
      sub.command('pre_uninstall', 'Runs pre uninstallation hooks.', function(cmd) {
        cmd.options(['-u', '--updating'], 'If true, will not run the module deactivation routine');
  
        if (via_npm() && process.getuid && process.getuid() !== 0) {
          var line = new Array(80).join('=');
          var msg  = "\n  Holy cow! Looks like you ran 'npm remove' but without the --unsafe-perm flag.";
              msg += '\n  This means the init scripts will remain installed, because they need root to be removed.\n';
              msg += '\n  To ensure a clean uninstall, please reinstall the package and then re-run this command, ';
              msg += '\n  only this time with the --unsafe-perm flag, so everything gets wiped out:\n';
              msg += '\n  $ sudo npm -g remove prey --unsafe-perm\n';
          shared.log(line + msg + line);
          return process.exit(1);
        }
  
        run(cmd, tasks.pre_uninstall);
      });
  
      sub.command('set_watcher', 'Sets up a parallel process that restores the prey user.', function(cmd) {
  
        if (process.platform != 'darwin') {
          return log('Service available only for macOS');
        }
        
        if (process.getuid && process.getuid() !== 0) {
          var line = new Array(80).join('=');
          var msg  = '\n  You are running this script as an unprivileged user';
              msg += '\n  so we cannot finalize setting up the client watcher.';
  
          shared.log(line + msg + line);
          return process.exit(0); // no error
        }
  
        run(cmd, daemon.set_watcher);
      });
  
      sub.start();
    });
  
    // settings
  
    cli.command('settings', 'View or modify Prey settings', function(sub) {
      sub.command('list', 'Shows all available settings in config file.', function(cmd) {
        run(cmd, settings.list);
      });
  
      sub.command('read', 'Returns value for specified setting.', function(cmd) {
        cmd.keyword('key', 'Key to look for.');
        run(cmd, settings.read);
      });
  
      sub.command('update', 'Updates setting in config file. (e.g. `update control-panel.protocol http`)', function(cmd) {
        cmd.keyword('key', 'Key to replace.');
        run(cmd, settings.update);
      });
  
      sub.command('toggle', 'Toggles boolean setting. (e.g. `toggle auto_connect`)', function(cmd) {
        cmd.keyword('key', 'Key to toggle.');
        run(cmd, settings.toggle);
      });
  
      sub.command('save_from_file', 'Save data to database from prey.conf file', function(cmd) {
        run(cmd, settings.fromFile);
      });

      sub.command('empty', 'Set setting to empty value. (e.g. `empty control-panel.device_key`)', function(cmd) {
        cmd.keyword('key', 'Key to look for.');
        run(cmd, settings.setEmpty);
      });
  
      sub.start();
    });
  
    cli.command('check', 'Verifies that current installation is correctly set up.', function(cmd) {
      run(cmd, install.check);
    });
  
    cli.command('log', 'Prints or dumps the contents of the Prey log file.', function(cmd) {
      cmd.options(['-o', '--output [file]'], 'Dump log output to [file].');
      run(cmd, log.write);
    });
  
    cli.command('gui', 'Opens GUI configurator to set up account.', function(cmd) {
      // NOTE: we need to use options rather than parameters, otherwise the command won't start.
      cmd.options(['-c', '--check-file [file]'], 'Check for API and Device keys in [file].');
      cmd.options(['-f', '--force'], 'Show GUI even if Prey is already set up.')
      run_if_writable(cmd, gui.check_and_show);
    });
  
    cli.command('panel', 'Opens web panel configurator to set up account.', function(cmd) {
      cmd.options(['-f', '--force'], 'Delete current credentials to configure a new account.');
      cmd.options(['-r', '--reset-keys'], 'Replace the security keys generating new ones.');
      if (process.platform == 'linux')
        run(cmd, panel.check_and_show);
      else
        run_if_writable(cmd, panel.check_and_show);
    });
  
    cli.start();
  });
}

var return_err;

start(function(err, message) {
  return_err = err;

  if (err && err.code == 'EACCES')
    err.message = messages.no_perms;
  else if (err && err.toString().indexOf('hang up') != -1)
    err.message = messages.connection_timeout;

  shared.log(err ? 'Error! ' + err.message : message || messages.exit_ok);
})

if (process.stdout) {
  process.stdout.on('error', function(e) {
    e.message = 'stdout error on conf/cli: ' + e.message;
    exceptions.send(e);
  })
}

process.on('uncaughtException', function(err) {
  shared.log('EXCEPTION! ' + err.message);
  shared.log(err.stack);

  return_err = err;
  exceptions.send(err, function(e) {
    process.exit();
  });
});

process.on('exit', function(code) {
  process.exit(return_err ? 1 : code);
});
