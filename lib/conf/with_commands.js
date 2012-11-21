var fs = require('fs'),
    path = require('path'),
    common = require('./../common'),
    system = common.system,
    hooks  = require('./' + common.os_name),
    unzip  = require('./../utils/unzip'),
    versions_list;

var Operetta = require('./../utils/operetta').Operetta,
    cli = new Operetta(),
    releases_url = 'http://localhost:8888/';

var package_path  = system.paths.package,
    config_path   = system.paths.config,
    log_file_path = system.paths.log_file,
    current_path,
    versions_path;

// check if parent path directory is called 'versions'. if not, then we assume
// this was installed on a static location (eg. via apt-get), which means we
// can't keep different versions.

var package_parent_path = fs.realpathSync(path.resolve(package_path, '..'));

if (path.basename(package_parent_path) == 'versions') {
  install_path = path.resolve(package_parent_path, '..');
  current_path  = path.join(install_path, 'current');
  versions_path = path.join(install_path, 'versions');
} else {
  current_path = package_path;
}

var package = {}

package.get_latest = function(current_version, dest, cb){
  package.check_latest_version(function(err, upstream_version){
    if (err || upstream_version == current_version)
      // return cb(err); // if err is empty, the process will set and the latest version IS set
      return cb(err || new Error('Latest version already installed.'));

    package.get_version(upstream_version, dest, function(err){
      callback(err, version);
    });
  })

};

package.get_version = function(version, dest, cb){
  package.download_release(version, function(err, file){
    if (err) return cb(err);
    package.install(file, dest, cb);
  });
}

package.download_release = function(version, cb){
  var package_url = releases_url + version;
  package.download(package_url, cb);
}

package.download = function(url, cb){
  var file = system.tempfile_path(path.basename(url) + '.zip');

  needle.get(url, { output: file }, function(err, resp, data){
    if (err) return cb(err);
    return cb(null, file);
  });
}

package.install = function(zip, dest, cb){
  unzip(zip, dest, cb);
}

////////////////////////////////////////////////
//
////////////////////////////////////////////////

var versions = {};

// return latest version in versions dir
versions.latest = function(cb){
  var list = this.list();
  var sorted = this.sort(function(a, b){ return a > b });
  return sorted[0];
}

// return version where this is being executed
versions.this = function(){
  return common.version;
}

// returns current symlinked version
versions.current = function(){
  try {
    var relative_path = fs.readlinkSync(current_path);
    return relative_path.match(/(\d\.\d\.\d)/)[0];
    // return path.join(install_path, relative_path);
  } catch(e) {
    console.log(current_path + ' not found.');
  }
}

// return list of all versions
versions.list = function(cb){
  if (versions_list) return versions_list;

  try {
    return versions_list = fs.readdirSync(versions_path);
  } catch (e) {
    console.log(versions_path + ' does not exist.');
  }
}

versions.set_current = function(version, cb){

  if (!versions_path)
    return cb();

  if (version == 'latest')
    version = versions.latest();
  else if (version == 'this')
    version = versions.this();

  var full_path = path.join(versions_path, version);

  fs.exists(full_path, function(exists){
    if (!exists) return cb(new Error('Path not found: ' + full_path));

    // symlink
    fs.unlink(current_path, function(err){
      // if (err) return cb(err);

      fs.symlink(full_path, current_path, {type: 'junction'}, cb)
    })
  })

}


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

settings.update = function(opts, cb){
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
		private_key: path.join(config_path, config.get('private_key')),
		certificate: path.join(config_path, config.get('certificate'))
	};

  ssl_keys.generate(key_paths, cb);
}

var logfile = {};

logfile.ensure = function(cb){
  fs.writeFile(log_file_path, '', cb);
}

////////////////////////////////////////////////
//
////////////////////////////////////////////////

var remote = {};

remote.authorize = function(args){
  console.log(args);
}

remote.verify = function(args){
  console.log(args);
}

remote.signup = function(args){
  console.log(args);
}

remote.attach = function(args){
  console.log(args);
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
  fs.exists(current_path, function(err){
    if (err) return cb(err);

    ensure_dir(config_path, function(err){
      if (err) return cb(err);

      ensure_config(function(err){
        if (err) return cb(err);

        ensure_keys(cb);
      });

    })
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
  if (versions_path) {

  // packages, install or update

  cli.command('install', 'Installs specified ZIP package into installation path.', function(cmd){
    cmd.parameters(['-f', '--file'], 'File to unpack into install path.');
    cmd.start(function(values){
      var file = values['-f'];
      if (!file) return cb(new Error('File path required.'));

      var destination = values['-d'] || install_path;

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
          destination = values['-d'] || install_path;

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

    sub.command('get', 'Returns value for specified setting.', function(cmd){
      cmd.start(function(values){
        console.log(values);
        var key = values.positional[0];
        if (!key) return cb(new Error('Key required.'));
        settings.get(key, cb);
      });
    });

    sub.command('list', 'Shows all available settings in config file.', function(cmd){
      cmd.start(function(){
        settings.list(cb);
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

  cli.command('authorize', 'Checks if credentials are valid.', function(cmd){
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

  cli.command('verify', 'Verifies API/Device keys. Defaults to the ones in config file.', function(cmd){
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

  cli.command('signup', 'Signs up for a new account on the Control Panel.', function(cmd){
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
      remote.signup(opts, cb);
    });
  });

  cli.command('attach', 'Registers device on the Control Panel under account.', function(cmd){
    cmd.start(function(values){
      var opts = values;
      console.log(values);
      remote.attach(function(err, key){
        if (err || !key)
          return cb(err || new Error("Couldn't get a device key."));

        settings.update({device_key: key}, cb)
      });
    });
  });

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

  cli.banner = "\n Prey Installation Manager - v" + common.version + "\n";
  cli.start();

}

run(function(err){
  console.log(err ? ' Error! ' + err.message : 'All good!');
})
