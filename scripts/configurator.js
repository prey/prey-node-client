
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
  fs = require('fs'),
  
  os = require('os'),
  platform = os.platform().replace('darwin', 'mac').replace('win32', 'windows'),
  versions_file = 'versions.json',
  crypto = require('crypto'),
  log_file,   // set if --log <log_file> is specified on command line
  os_hooks,   //  set after install path is checked for valid prey dir
  register;   //  set after install path is checked for valid prey dir

/**
 * The keys are the parameters that may be passed from the command line, the function is applied
 * to the value passed by the user before saving with getset.
 *
 * A modifier function returning null will prevent the given value being saved, a null function is simply ignored.
 **/
var config_keys = {
  email:null,
//  user_password:function(val) { return crypto.createHash('md5').update(val).digest("hex"); },
  user_name:null,
  user_password:null,
  auto_connect:null ,
  extended_headers:null ,
  post_method:null ,
  api_key:null ,
  device_key:null ,
  check_url:null ,
  mail_to:null,
  proxy_url:null,
  smtp_server:null ,
  smtp_username:null ,
  smtp_password:null 
};

var etc_dir = function() {
  return os_hooks.etc_dir;
};

/**
 * I think this platform specific stuff needs to be here as I can't load os_hooks without knowing this
 * in advance.
 **/
var prey_bin = function() {
  if (platform === 'linux') return '/usr/local/bin/prey';
};

var indent = '';
var _tr  = function(msg) {
  var m = msg.split(/^([0-9]):/);
  
  if (m.length === 1) {
    if (log_file)
      fs.appendFileSync(log_file,indent + ' -- '+m[0]+'\n');
    else
      console.log(indent + ' -- '+m[0]);
  }

  if (m.length === 3) {
    var lev = m[1];
    if (lev > 0 || lev !== indent.length) {
      indent = '';
      for (var i = 0; i < lev ; i++)
        indent += ' ';
    }

    var log_line = indent+m[2];
    if (log_file) 
      fs.appendFileSync(log_file,log_line+'\n');
    else 
      console.log(log_line);
  }
};

/**
 * Print msg and exit process with given code.
 **/
var exit_process = function(error,code) {
  _tr('EXIT_PROCESS ('+code+')');
  _tr(inspect(error));

  if (code) process.exit(code);
  process.exit(0);
};

/**
 * Used in debug_error for getting source file and line of error.
 **/
var whichFile = function() {
  var e = new Error('blah'); 

  var m = e
        .stack
        .split("\n")[3]
        .trim()
        .match(/at (\S+) (\(([A-Z]:)?[^:]+):([0-9]+)/);
  
  return (m) ? {func:m[1],file:m[2],line:m[4] } : null;
};

/**
 * Print the full context of the error and where it was generated 
 * then bails.
 **/
var debug_error = function(err,context) {
  // check if first parameter is already an error object
  if (typeof  err === 'object') {
    if (err.error) return err; 
  }

  err = {error:err,context:context,location:whichFile()};
  exit_process(err,1);
};

/**
 * Create an error object - let top level functions handle printing/logging.
 **/
var standard_error = function(err,context) {
  if (typeof err === 'object') {
    if (err.error) return err;
  }
  return {error:err,context:context};
};

/**
 * Default to standard error handling add --debug on command line for debug error handler.
 **/
var _error = standard_error;

/**
 * Parameters that are specified in the gui (or whereever) are handled separately to the 
 * other command line options so they may be handled in bulk.
 **/
var make_parameters = function(commander) {
  Object.keys(config_keys).forEach(function(key) {
    commander.option('--'+key+' <'+key+'>','');
  });
} ;

/**
 * Get a command line parameter value, and apply it's modifier.
 **/
var get_parameter_value = function(key) {
  var val = commander[key];
  if (val) {
    if(config_keys[key]) {
      // have a value modifer ...
      val = (config_keys[key])(val);
    }
  }
  return val;
};

/**
 * The commander object should hold all of the options that have been set by the user.
 * The keys are config_keys.
 **/
var update_config = function(installDir,callback) {
  var config = _ns('common').config;
  Object.keys(config_keys).forEach(function(key) {
    var val = get_parameter_value(key);
    if (val) {
      // the modifier can set the param to null if it shouldn't be saved for 
       // some reason
       config.set(key,val,true); // force option setting
    }
  });

  config.save(function(err) {
    if (err) return callback(_error(err));

    _tr('saved config ...');
    callback(null);
  });
};

/**
 * Write an array of all currently installed versions of prey into the /etc/prey/versions.json.
 **/
var write_versions = function(versions,callback) {
  var vf = etc_dir() + versions_file;
  fs.writeFile(vf,JSON.stringify(versions),function(err) {
    if (err) return callback(_error(err));

    callback(null);
  });
};

/**
 * Get an array of paths to installed versions of prey from /etc/prey/versions.json.
 **/
var read_versions = function(callback) {
  var vf  = etc_dir() + versions_file;
  fs.readFile(vf,'utf8',function(err,content) {

    if (err) {
      if (err.code !== 'ENOENT') {
      // if the file does not exist, ignore the error, otherwise it's unexpected ...
        return callback(_error(err));
      } else {
        // if the file simply does not exist, then there are no installations
        return callback(null,[]);
      }
    } 

    // otherwise return the array of installations
    callback(null,JSON.parse(content));
  });
};

/**
 * Create the symlink to bin/prey.js.
 **/
var create_symlink = function(installDir,callback) {
  var bin = prey_bin();
  fs.lstat(bin,function(err,stat) {
    if (stat) {
      fs.unlink(bin,function(err) {
        if (err) {
          if (err.code === 'EACCES') {
            _tr('You should be running under root.');
          } 
          return callback(_error(err));
        }

        fs.symlink(installDir + '/bin/prey.js',bin,function(err) {
          if (err) return callback(_error(err));

          callback(null);
        });
      });
    }
  });
};

/**
 * Update the global prey symlink to point to the newly installed version.
 **/
var create_new_version = function(installDir,callback) {
  create_symlink(installDir,function(err) {
    if (err) return callback(_error(err));

    // update versions array ...
    read_versions(function(err,versions) {
      if (err) return callback(_error(err));
      
      // already have a note of this installation, don't add it again to the array
      if (versions.indexOf(installDir) !== -1) {
        _tr('Have reference to '+installDir + ' already');
        return callback(null);
      }
      
      // versions is always initialized to something in read_versions
      versions.push(installDir);
      
      write_versions(versions,function(err) {
        if (err) return callback(_error(err));
        
        callback(null);
      });
    });
  });
};

/**
 * Current version can be queried by reading the /usr/bin/prey (or equivalent) symlink
 * and stripping bin/prey.js off end.
 **/
var get_current_version_path = function(callback) {
  fs.readlink(prey_bin(),function(err,pathToBin) {
    if (err) return callback(_error(err));

    callback(null,pathToBin.substr(0,pathToBin.length - ("bin/prey.js".length)));
  });
};

/**
 * Get package info from a prey installation dir.
 **/
var read_package_info = function(path,callback) {
  try {
    var info = require(path + '/package.json');
    callback(null,info);
  } catch(e) {
    callback(_error(e,path));
  }
};

/**
 * Get the package data for the current prey.
 **/
var get_current_info = function(callback) {
  get_current_version_path(function(err,path) {
    if (err) return callback(_error(err));
    
    read_package_info(path,callback);
  });
};

/**
 * Validates that a given path is a path to a Prey installation dir, callsback the prey version if successful.
 **/
var check_prey_dir = function(path,callback) {
  fs.exists(path,function(exists) {
    if (!exists) return callback(_error(path +' does not exist'));
    
    fs.stat(path,function(err,stat) {
      if (err) return callback(_error(err));
      if (!stat.isDirectory()) return callback(_error(path +' is not a directory'));

      read_package_info(path,function(err,info) {
        if (err) return callback(_error(err));

        callback(null,info.version);
      });
    });
  });
};

/**
 * Make sure the etc dir exists
 **/
var check_etc_dir = function(callback) {
  fs.exists(etc_dir(),function(exists) {
    if (exists)  return callback(null);
    
    fs.mkdir(etc_dir(),function(err) {
      if (err) return callback(_error(err));

      callback(null);
    });
  });
};

/**
 * Have path to an installation, initialize it's namespaces and global vars
 **/
var initialize_installation = function(path) {
  require(path+'/lib');
  //var common = _ns('common');
  //_tr('Using:'+common.config_path+'/prey.conf');
  os_hooks = require(path + '/scripts/' + platform + '/hooks');
  register = _ns('register');  
};

/**
 * Get identifying keys from config file.
 **/
var get_keys = function(callback) {
  var common = _ns('common'),
      conf = common.config;

  callback({device:conf.get('control-panel','device_key'),api:conf.get('control-panel','api_key')});
};

/**
 * Must be called after initialize_installation.
 **/
var check_keys = function(callback) {
  get_keys(function(keys) {

    if(!keys.device) {
      _tr("Device key not present.");
    }

    if(!keys.api)
      return callback(_error("No API key found."));

    callback(null,keys);
  });
};

/**
 * Select the current prey version, and initializes it's
 * namespaces.
 **/
var with_current_version = function(callback) {
  get_current_version_path(function(err,path) {
    if (err) return callback(_error(err)); 

    initialize_installation(path);
    callback(null,path);
  });
};

/**
 * Iterate over versions
 **/
var each_version = function(callback) {
  with_current_version(function(err,path) {
    if (err) return callback(_error(err));

    read_versions(function(err,versions) {
     if (err) return callback(_error(err));
     
     versions.forEach(function(path) {
       read_package_info(path,function(err,info) {
         if (err) return callback(_error(err));

         callback(null,{pack:info,path:path});
       });
     });
   });
  });
};

/**
 * Make sure all parameters specified in array are available from command line
 * and have values.
 **/
var required = function(req) {
  var vals = [];
  var missing = [];
  req.forEach(function(p) {
    var val = get_parameter_value(p);
    if (!val) 
      missing.push(p);
    else
      vals.push(val);
  });
  if (missing.length > 0) return {values:null,missing:missing};
  return {values:vals};
};

/**
 * From command line params, email,user_password and name, register a user.
 * Make sure required params array are values are indexed in order. 
 **/
var signup = function(callback) {
  _tr("Signing up user...");

  var req_params = required(['user_name','email','user_password']);
  
  if (!req_params.values) {
    return callback(_error('signup: The following fields are required:',inspect(req_params.missing)));
  }
  
  var prms = req_params.values,
      packet = {
        user: {
          name: prms[0],
          email: prms[1],
          password: prms[2],
          password_confirmation: prms[2]
        }
      };

  register.new_user(packet, function(err, data){
    if (err) return callback(_error(err));

    callback(null);
  });
};

/**
 * From command line params, email,user_password make sure we have a valid user.
 * Then saves the returned api_key to config.
 * Callsback the api_key.
 **/
var validate_user = function(callback) { 
  _tr("Validating user...");

  var req_params = required(['email','user_password']);

  if (!req_params.values) {
    return callback(_error('validate_user: The following fields are required:',inspect(req_params.missing)));
  }
  
  var prms = req_params.values,
      packet = { username: prms[0] , password: prms[1] };
  
  register.validate(packet, function(err, data){
    if (err) return callback(_error(err));

    var api_key = data.api_key,
        config = _ns('common').config;

    // yuck
    var hash = {'control-panel': {}};
    hash['control-panel']['api_key'] = api_key;
    config.merge(hash, true);
    config.save(function(err) {
      if (err) return callback(_error(err));
      callback(null,api_key);     
    });
  });
};

/**
 * Take the path provided, usually by the installer gui, to the top level directory of a new
 * Prey installation.
 *
 * After validating the path is a Prey installation, initialize it's globals file, and common.js 
 * file to get valid paths to various system locations.
 *
 * Add the new installation to an array of installation paths.
 *
 * Read any of the config_options from the command line, and save them using getset to the default
 * config file.
 *
 * Install os hooks, using installation's hook stuff. 
 **/
var configure = function(path) {
  check_prey_dir(path,function(err,version) {
    if (err) exit_process(err,1);

    _tr('1:Configuring Prey '+version);
    initialize_installation(path);
    
    check_etc_dir(function(err) {
      if (err) exit_process(err,1);

      _tr('1:Creating new version ...');
      create_new_version(path,function(err) {
        if (err) exit_process(err,1);

        _tr('1:Updating config ...');
        update_config(path,function(err) {
          if (err) exit_process(err,1);

          _tr('1:Post install ...');
          os_hooks.post_install(function(err) {
            if (err) exit_process(err,1);

            _tr('1:Validating user ...');
            validate_user(function(err) {
              if (err) exit_process(err,1);

              exit_process('1:Prey Configured successfully.',0);
            });
          });
        });
      });
    });
  });
};

/**
 * Set the current version of Prey to run.
 * Always runs the os_hooks.post_install of the installation to make
 * sure that that versions init scripts are copied.
 **/
var set_version = function(wanted_version,callback) {
  each_version(function(err,ver) {
    if (err) return callback(_error(err));

    if (ver.pack.version === wanted_version) {
      create_symlink(ver.path,function(err) {
        if (err) return callback(_error(err));

        os_hooks.post_install(function(err) {
          if (err) exit_process(err,1);
          exit_process("Prey" + ver.path+' set',0);
        });
      });
    }
  });
};

/**
 * Register the current device with the Prey control panel.
 **/
var register_device = function(callback) {
  with_current_version(function(err) {
    if (err) callback(_error(err));

    get_keys(function(keys) {
      if (!keys.api) return callback(_error('You need to signup first'));
      if (keys.device) return callback(_error('Device key already registered'));
      
      var reg = _ns('register');
      _tr('registering device with '+keys.api);
      reg.new_device({api_key:keys.api},function(err) {
        if (err) return callback(_error(err));

        callback(null);
      });
    });
  });
};

/**
 * Finally, read the command line.
 **/
commander
  .option('--configure <from_path>', 'Configure installation.')
  .option('--versions','List installed versions')
  .option('--set <version>','Set current version')
  .option('--current','Return current version')
  .option('--run','Run currently set Prey installation')
  .option('--signup','Requires params name,email,user_password')
  .option('--validate','Requires params email, user_password')
  .option('--list_options','List options that be be used with --configure or --update')
  .option('--update','Update options for the current installation')
  .option('--check','Check for valid installation')
  .option('--register','Register the current device')
  .option('--log <log_file>','Log configurator output to log_file')
  .option('--debug');

make_parameters(commander);

commander.parse(process.argv);

if (commander.debug) {
  _error = debug_error;
}

if (commander.log) {
  log_file = commander.log;
  if(fs.existsSync(log_file)) fs.unlinkSync(log_file);
}

if (commander.configure) {
  configure(commander.configure);
}

if (commander.versions) {
  each_version(function(err,ver) {
    if (!err)
      console.log(ver.pack.version+':'+ver.path);
  });
}

if (commander.set) {
  set_version(commander.set,function(err) {
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

    var child = spawn('node', [prey_bin(),'-l',info.version+'.log'], {
      detached: true,stdio: 'ignore' 
    });

    child.unref();
  });
}

if (commander.signup) {
  with_current_version(function(err) {
    if (err) exit_process(err,1);

    signup(function(err) {
      if (err) exit_process(err,1);

      exit_process('User registerd ok',0);
    });
  });
}

if (commander.validate) {
  with_current_version(function(err) {
    if (err) exit_process(err,1);

    validate_user(function(err,api_key) {
      if (err) exit_process(err,1);

      console.log(inspect(api_key));
      exit_process('User validated ok',0);
    });
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
    os_hooks.post_install(function(err) {
      if (err) exit_process(err,1);

      check_keys(function(err,keys) {
        if (err) exit_process(err,1);
        _tr('keys'+inspect(keys));
        exit_process('all good',0);
      });
    });
  });
}

if (commander.register) {
  register_device(function(err) {
    if (err) exit_process(err,1);

    exit_process('Device registered',0);
  });
}
