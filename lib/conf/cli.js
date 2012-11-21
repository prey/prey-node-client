var fs = require('fs'),
    path = require('path'),
    common = require('./../common'),
    system = common.system,
    paths  = system.paths,
    hooks  = require('./' + common.os_name),
    unzip  = require('./../utils/unzip'),
    ensure_dir = require('./../utils/ensure_dir'),
    versions_list;

var Operetta = require('./../utils/operetta').Operetta,
    cli = new Operetta();

var package  = require('./package'),
    versions = require('./versions'),
    remote   = require('./remote'),
    messages = require('./messages'),
    helpers  = require('./helpers'),
    prompt   = require('./prompt');

////////////////////////////////////////////////
//
////////////////////////////////////////////////

var settings = {}

settings.get = function(key, cb){
  console.log(config.get(key));
  cb();
}

settings.list = function(cb){
  console.log(Object.keys(config._values));
}

settings.update = function(key, val, cb){
  config.update(opts, cb);
}

////////////////////////////////////////////////
//
////////////////////////////////////////////////

ensure_config = function(cb){
  config.sync(common.default_config_file, cb);
}

// make sure keys are there
ensure_keys = function(paths, cb){

	var key_paths = {
		private_key: path.join(paths.config, config.get('private_key')),
		certificate: path.join(paths.config, config.get('certificate'))
	};

  ssl_keys.generate(key_paths, cb);
}

var logfile = {};

logfile.ensure = function(cb){
  fs.writeFile(paths.log_file, '', cb);
}

////////////////////////////////////////////////
//
////////////////////////////////////////////////

// sets version as the active/current one,
// and then calls set_up_current so that
// config is copied or synced
var set_up_version = function(version, cb){
  versions.set_current(version, function(err){
    if (err) return cb(err);

    set_up_current(cb);
  });
}

var set_up_current = function(cb){
  fs.exists(paths.current, function(err){
    if (err) return cb(err);

    ensure_dir(paths.config, function(err){
      if (err) return cb(err);

      ensure_config(function(err){
        if (err) return cb(err);

        ensure_keys(cb);
      });
    });
  });
}

////////////////////////////////////////////////
//
////////////////////////////////////////////////

var run_tests = function(){
  console.log('Running tests.');
}

var check_installation = function(cb){
  var keys = config.get('control-panel'),
      opts = {api_key: keys.api_key, device_key: keys.device_key};

  remote.validate(opts, function(err){
    if (err) return cb(err);
  });
}

var run = function(cb) {

  // called after the files have been copied.
  // should be called from /usr/lib/prey/versions/1.5.2
  cli.command('activate', 'Completes installation, setting this as the active one.', function(cmd){
    cmd.start(function(values){
      set_up_version('this', function(){
        hooks.post_install(cb);
      });
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

      package.install(file, destination, function(err, version){
        if (err) return cb(err);
        set_up_version(version, cb);
      });
    });
  });

  // fetches the latest package from the releases repo
  // if install goes through
  // should be called from /usr/lib/prey/versions/1.5.2
  cli.command('upgrade', 'Downloads and installs greater Prey version, if any.', function(cmd){
    cmd.start(function(values){
      var latest_installed = versions.latest(),
          current_version = versions.current(),
          destination = values['-d'] || paths.install;

      package.get_latest(latest_installed, destination, function(err, version){
        if (err) return cb(err);

        // if (latest_version != current_version)
          set_up_version(version, cb);
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
        versions.set_current(version[0], cb);
      });
    });

    sub.start();

  });

  }

  cli.command('settings', 'Manage settings', function(sub){

    sub.command('list', 'Shows all available settings in config file.', function(cmd){
      cmd.start(function(){
        settings.list(cb);
      });
    });

    sub.command('get', 'Returns value for specified setting.', function(cmd){
      cmd.start(function(values){
        console.log(values);
        var key = values.positional[0];
        if (!key) return cb(new Error('Key required.'));
        settings.get(key, cb);
      });
    });

    sub.command('set', 'Updates setting in config file.', function(cmd){
      cmd.start(function(values){
        var key = values.positional[0],
            val = values.positional[1];

        if (!val) return cb(new Error('Please provide a value.'))
        settings.update(values, cb);
      });
    });

    sub.start();

  });

  // account
  cli.command('account', 'Prey account commands', function(sub){

    sub.command('authorize', 'Checks if credentials are valid.', function(cmd){
      cmd.parameters(['-a', '--api_key'], 'API Key.')
      cmd.parameters(['-e', '--email'], 'Email.')
      cmd.parameters(['-p', '--password'], 'Password.')
      cmd.start(function(values){
        var opts = {
          api_key: values['-a'],
          email: values['-e'],
          password: values['-p']
        };
        remote.authorize(opts, cb);
      });
    });

    sub.command('verify', 'Verifies API/Device keys. Defaults to the ones in config file.', function(cmd){
      cmd.parameters(['-a', '--api-key'], 'API Key.')
      cmd.parameters(['-d', '--device-key'], 'Device Key.')
      cmd.start(function(values){
        var opts = {
          api_key: values['-a'],
          device_key: values['-d']
        };
        remote.verify(opts, cb);
      });
    });

    sub.command('signup', 'Signs up for a new account on the Control Panel.', function(cmd){
      cmd.parameters(['-n', '--name'], 'Name.')
      cmd.parameters(['-e', '--email'], 'Email.')
      cmd.parameters(['-p', '--password'], 'Password.')
      cmd.parameters(['-c', '--country'], 'Country name.')
      cmd.start(function(values){

        var opts = {
          user_name: values['-n'],
          email: values['-e'],
          password: values['-p'],
          country: values['-c']
        };

        remote.signup(opts, function(err, data){
          if (err || !data.api_key)
            return cb(err || new Error('No API Key received.'));

          console.log('Account successfully created!');
          settings.update('control-panel', {api_key: data.api_key}, cb);
        });
      });
    });

    sub.command('setup', 'Starts interactive command-line account setup.', function(cmd){
      cmd.start(function(values){

        var api_key   = config.get('control-panel').api_key,
            run_again = values.positional[0];

	      if (api_key !== '' && !run_again)
		      return cb(new Error("Account already set up!"));

        prompt.start(cb);
      });
    });

    sub.start();

  })

  cli.command('hooks', 'Post install/pre install hooks', function(sub){

    // called after the files have been copied.
    // should be called from /usr/lib/prey/versions/1.5.2
    sub.command('post_install', 'Set up installation after files have been copied', function(cmd){
      cmd.start(function(values){
        hooks.post_install(cb);
      });
    });

    sub.command('pre_uninstall', 'Calls OS pre_uninstall hook', function(cmd){
      cmd.start(function(values){
        hooks.pre_uninstall(cb);
      });
    });

    sub.start()

  })

  cli.command('check', 'Verifies that current installation is fine and dandy.', function(cmd){
    cmd.start(function(values){
      console.log('Checking installation.');
      check_installation(cb);
    });
  });

  cli.command('run', 'Runs Prey. Registers device if API is set but no Device key.', function(cmd){
    cmd.start(function(values){
      helpers.run_detached(system.paths.prey_bin)
    });
  });


  // cli.banner = "\n Prey Installation Manager - v" + common.version + "\n";
  cli.start();

}

run(function(err){
  console.log(err ? ' Error! ' + err.message : 'All good!');
})
