
"use strict";

/**
 * Assumptions:
 * 1. This is run under root.
 * 2. The install directory provided to --configure is the final resting place of the installation.
 * 3. Registering a user is not an interactive Q&A, but rather the correct details are passed on the CLI.
 *
 * This module should:
 *   writes new key/vals from opts to config, if any
 *   sets current version
 *   verify account credentials, create user account or device
 *   sets crontab/system service for execution
 *   return code 0 if all was good
 *
 * Notes:
 *   Need to update hooks.js for other platforms, add etc_dir
 **/

var
  inspect = require('util').inspect,
  commander = require('commander'),
  exec = require('child_process').exec,
  async = require('async'),
  fs = require('fs'),
  tmp = require('tmp'),
  common = require('./../common'),
  system = common.system,
  hooks  = require('./' + system.os_name),
  ensure_dir = require('./../utils/ensure_dir');

var _install_dir  = system.paths.install,
    _versions_dir = path.join(system.paths.install, 'versions');
    _no_internet  = false;

/**
 * Exit config if no internet has been flagged.
 **/
var fails_on_no_internet = function(action) {
  if (_no_internet)
    exit_process(action+' action needs an internet connection',1);
};

var npm_update = function(path,callback) {
  process.chdir(path);
  _tr('doing npm update in '+path);
  exec('npm update',function(err) {
    if (err) return callback(_error(err));
    callback(null);
  });
};

var generate_keys = function(cb){
	// config.private_key_path is invalid because config file does not exist
	var key_paths = {
		private_key: path.join(common.config_path, config.get('private_key')),
		certificate: path.join(common.config_path, config.get('certificate'))
	};

	ssl_keys.generate(key_paths, cb);
}

var post_install = function(callback) {
    _tr('1:Post install ...');
    hooks.post_install(callback);
};



/**
 * Have path to an installation, initialize it's namespaces and global vars
 **/
var initialize_installation = function(path, callback) {
  config.ensure(function(err) {
    if (err) return callback(_error(err));

    check_prey_dir(path,function(err,path) {
      if (err) return callback(_error(err));

      callback(null, path);
    });
  });
};

/**
 * Initialize _install_dir and _versions_dir global variables and make
 * sure said directories exist.
 **/
var ensure_system_dirs = function(callback) {
  ensure_dir(versions_dir, callback);
};


/**
 * Take the path provided, usually by the installer gui, to the top level directory of a new
 * Prey installation.
 *
 * After validating the path is a Prey installation, initialize it's globals file, and common.js
 * file to get valid paths to various system locations.
 *
 * Add the new installation
 *   linux/mac: to an array of installation paths,
 *   windows: array implicit in windows versions dir
 *
 * Read any of the config_options from the command line, and save them using getset to the default
 * config file.
 *
 * Install os hooks, using installation's hook stuff.
 **/
var configure = function(path, callback) {
  _tr('1:Configuring ...');

  async.waterfall([

    function(cb) {
      _tr('Checking if Prey in path '+path+ '...');
      check_prey_dir(path, cb);
    },

    function(p, cb) {
      fs.exists(path+'/node_modules',function(exists) {
        if (exists) return cb(null);
        _tr("node_modules doesn't exist doing npm update");
        npm_update(path, cb);
      });
    },

    function(cb) {
      _tr('1:Creating new version for ' + path);
      create_new_version(path, cb);
    },

    function(cb) {
      _tr('1:Initializing installation ...');
      initialize_installation(path, cb);
    },

    function(path,cb) {
      _tr('1:Updating config ...');
      update_config(path, cb);
    },

    function(cb) {
      post_install(cb);
    }
    ],
    callback
    );
};


var actions = function() {
  commander.parse(process.argv);

  if (commander.debug) {
    require('./../utils').debug.enable();
  }

//  if (commander.log) {
//    base.set_log_file(commander.log);
//  }

  if (commander.configure) {
    configure(commander.configure, function(err) {
      if (err) exit_process(err,1);
      exit_process('Prey configured successfully.',0);
    });
  }

  if (commander.versions) {
    each_version(function(err,ver) {
      if (err) exit_process(err,1);

      console.log(ver.pack.version+':'+ver.path);
    });
  }

  if (commander.set) {
    set_version(commander.set, function(err) {
      if (err) exit_process(err,1);
      exit_process('version now '+commander.set,0);
    });
  }

  if (commander.current) {
    get_current_info(function(err,info) {
      if (err) exit_process(err,1);
      console.log(info.version);
    });
  }

  if(commander.run) {
    var spawn = require('child_process').spawn;
    get_current_info(function(err,info) {
      if (err) exit_process(err,1);

      var log_file = info.version+'.log';
      _tr('logging to '+log_file);
      var child = spawn('node', [prey_bin(),'-l',log_file], {
        detached: true,stdio: 'ignore'
      });

      child.unref();
    });
  }

  if (commander.list_options) {
    Object.keys(config_keys).forEach(function(key) {
      console.log('--'+key);
    });
  }

  if (commander.update) {
    with_current_version(function(err,path) {
      if (err) exit_process(err,1);

      update_config(path,function(err) {
        if (err) exit_process(err,1);

        exit_process('Options updated',0);
      });
    });
  }

  if (commander.check) {
    with_current_version(function(err,path) {
      if (err) exit_process(err,1);

      /* rather than checking for existence of file, just copy init script for this version */
      hooks.post_install(function(err) {
        if (err) exit_process(err,1);

        check_keys(function(err,keys) {
          if (err) exit_process(err,1);
          _tr('keys'+inspect(keys));
          exit_process('all good',0);
        });
      });
    });
  }

  // actions with internet requirement ...

  if (commander.signup) {
    fails_on_no_internet('signup');
    with_current_version(function(err) {
      if (err) exit_process(err,1);

      signup(function(err) {
        if (err) exit_process(err,1);

        exit_process('User registerd ok',0);
      });
    });
  }

  if (commander.validate) {
    fails_on_no_internet('validate');
    with_current_version(function(err) {
      if (err) exit_process(err,1);

      validate_user(function(err,api_key) {
        if (err) exit_process(err,1);

        console.log(inspect(api_key));
        exit_process('User validated ok',0);
      });
    });
  }

  if (commander.register) {
    fails_on_no_internet('register');
    register_device(function(err) {
      if (err) exit_process(err,1);

      exit_process('Device registered',0);
    });
  }

  if (commander.install) {
    fails_on_no_internet('install');
    var url = commander.install;
    install(url,function(err) {
      if (err) exit_process(err,1);
      exit_process('Install successful.',0);
    });
  }
};


/**
 * Handle command line processing.
 **/
var process_cli = function() {
  commander
  .option('--configure <from_path>', 'Configure installation.')
  .option('--versions','List installed versions')
  .option('--set <version>','Set current version')
  .option('--current','Return current version')
  .option('--run','Run currently set Prey installation')
  .option('--signup','Requires params user_name,email,user_password')
  .option('--validate','Requires params email, user_password')
  .option('--list_options','List options that be be used with --configure or --update')
  .option('--update','Update options for the current installation')
  .option('--check','Check for valid installation')
  .option('--install <url>','Fetch and configure a new version of Prey from the url.')
  .option('--register','Register the current device')
  .option('--log <log_file>','Log configurator output to log_file')
  .option('--debug');

  make_parameters(commander);

  require('dns').lookup('google.com',function(err) {
    if (err) {
      console.log("Looks like you don't have an internet connection.");
      _no_internet = true;
    }

    ensure_system_dirs(function(err) {
      if (err) return exit_process(err,1);

      actions();
    });
  });
};

/**
 * Switch between use as module or from command line.
 **/
if(require.main === module)
  process_cli();
else {
   module.exports.configure = function(path, callback) {
      ensure_system_dirs(function(err) {
        if (err) return exit_process(err,1);

        configure(path, callback);
    });
   };
}
