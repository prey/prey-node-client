"use strict";

/**
 * Assumptions:
 * 1. This is run under root.
 * 2. The install directory provided is the final resting place of the installation.
 * 3. The install deposits a file, install_options.json into the root directory of the installation.
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
  os_hooks;   //  set after install path is checked for valid prey dir

/**
 * The keys are the parameters that may be passed from the command line, the function is applied
 * to the value passed by the user before saving with getset.
 *
 * A modifier function returning null will prevent the given value being saved. 
 **/
var config_keys = {
  email:null,
  user_password:function(val) { return crypto.createHash('md5').update(val).digest("hex"); },
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
  if (m.length === 1)
    console.log(indent + ' -- '+m[0]);
  if (m.length === 3) {
    var lev = m[1];
    if (lev > 0 || lev !== indent.length) {
      indent = '';
      for (var i = 0; i < lev ; i++)
        indent += ' ';
    }
    console.log(indent+m[2]);
  }
};

var whichFile = function() {

  var e = new Error('blah'); 

  //  console.log("Error line: "+e.stack.split("\n")[3]);
  //console.log(e.stack);
  
  var m = e
        .stack
        .split("\n")[3]
        .trim()
        .match(/at (\S+) (\(([A-Z]:)?[^:]+):([0-9]+)/);
  
  return (m) ? {func:m[1],file:m[2],line:m[4] } : null;
};

var _error = function(err,context) {
  // check if first parameter is already an error object
  if (typeof  err === 'object') {
    if (err.error) return err; 
  }

  err = {error:err,context:context,location:whichFile()};
  
  console.log(">>> -----------------------------------------------------------------");
  console.log(inspect(err));
  console.log("<<< -----------------------------------------------------------------");
  return err;
};

/**
 * The commander object should hold all of the options that have been set by the user.
 * The keys are config_keys.
 **/
var update_config = function(installDir,callback) {
  var config = _ns('common').config;
  Object.keys(config_keys).forEach(function(key) {
    var val = commander[key];
    if (val) {
      _tr('setting '+key+' to '+val);
      if(config_keys[key]) {
        // have a value modifer ...
        val = (config_keys[key])(val);
      }
      if (val) {
        // the modifier can set the param to null if it shouldn't be saved for 
        // some reason
        config.set(key,val,true); // force option setting
      }
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
};

/**
 * Select the current prey version
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
 * Print msg and exit process with given code.
 **/
var exit_process = function(error,code) {
  if (typeof error === 'Object') {
    _tr('EXIT_PROCESS ('+code+')');
    _tr(inspect(error));
  }  else {
    console.log('!EXIT_PROCESS ('+code + ') ' + error);
  }

  if (code) process.exit(code);
  process.exit(0);
};

/**
 * From the information provided by the installer, via the command line,
 * make sure we have a valid user.
 **/
var validate_or_register_user = function(callback) {
  
  callback(null);

  var register = _ns('register');
    
  if (commander.email && commander.password) { // validate
    _tr("Verifying credentials...");

    var options = { username: commander.email, password: commander.pass };
    register.validate(options, function(err, data){
      if (!err) {
        callback(null);      
      }
    });
  }
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
            validate_or_register_user(function(err) {
              exit_process('1:Prey Configured successfully.',0);
            });
          });
        });
      });
    });
  });
};

/**
 * Parameters that are specified in the gui (or whereever) are handled separately to the 
 * other command line options so they may be handled in bulk. Also the config_key options
 * are only read on a --configure.
 **/
var make_parameters = function(commander) {
  Object.keys(config_keys).forEach(function(key) {
    commander.option('--'+key+' <'+key+'>','');
  });
} ;

commander
  .option('--configure <from_path>', 'Configure installation')
  .option('--list','List installed versions')
  .option('--set <version>','Set current version')
  .option('--current','Return current version')
  .option('--run');

make_parameters(commander);

commander.parse(process.argv);

if (commander.configure) {
  configure(commander.configure);
}

if (commander.list) {
  each_version(function(err,ver) {
    if (!err)
      console.log(ver.pack.version+':'+ver.path);
  });
}

if (commander.set) {
  each_version(function(err,ver) {
    if (!err) {
      if (ver.pack.version === commander.set) {
        create_symlink(ver.path,function(err) {
          if (err) {
            _tr(err);
            process.exit(1);
          }
          console.log(ver.path);
          process.exit(1);
        });
      }
    }
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

 var child = spawn('node', [prey_bin(),'-l','/home/ritchie/Projects/Prey/ritchie.log'], {
  detached: true,stdio: 'ignore' 
  });

 child.unref();
}
