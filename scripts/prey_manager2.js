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
 *   sets crontab/system service for execution
 *   return code 0 if all was good
 *
 * Notes:
 *   Need to update hooks.js for other platforms, add etc_dir
 **/

var
  exp = module.exports,
  _ = require('underscore'),
  inspect = require('util').inspect,
  commander = require('commander'),
  fs = require('fs'),
  os = require('os'),
  platform = os.platform().replace('darwin', 'mac').replace('win32', 'windows'),
  versions_file = 'versions.json',
  pathToPrey, // set after install path is checked for valid prey dir
  os_hooks;  //  set after install path is checked for valid prey dir


var etc_dir = function() {
  return os_hooks.etc_dir;
};

var prey_bin = function() {
  return os_hooks.prey_bin;
};

var _tr  = console.log;

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

  var err = {error:err,context:context,location:whichFile()};
  
  console.log(">>> -----------------------------------------------------------------");
  console.log(inspect(err));
  console.log("<<< -----------------------------------------------------------------");
  return err;
};


/**
 * Read a file options.json from the root of the installation directory.
 * options.json is a file deposited by the installer based on the installation selections of the user.
 **/
var read_options = function(installDir,callback) {
  fs.exists(installDir,function(exists) {
    if (!exists) return callback(_error(installDir+' does not exist'));
    
    fs.stat(installDir,function(err,stat) {
      if (err) return callback(_error(err));
      if (!stat.isDirectory()) return callback(_error(installDir +' is not a directory'));
      
      var optionsFile = installDir + '/install_options.json';
      fs.exists(optionsFile,function(exists) {
        if (!exists) return callback(_error(optionsFile + ' does not exist'));
        
        var options = JSON.parse(optionsFile) ;
        callback(null,options);
      });
    });
  });
};

/**
 * 
 **/
var update_config = function(installDir,options) {
  
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
 * Update the global prey symlink to point to the newly installed version.
 **/
var create_new_version = function(installDir,callback) {
  var bin = prey_bin();
  _tr('checking for existing '+bin);
  fs.lstat(bin,function(err,stat) {
    if (stat) {
      _tr('unlinking existing '+bin);
      fs.unlinkSync(bin);
    }
    
    fs.symlink(installDir + '/bin/prey.js',bin,function(err) {
      if (err) return callback(_error(err));

      _tr('symlinked new version to '+bin);
      
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
    callback(_error(e));
  }
};

/**
 * Get the package data for the current prey.
 **/
var get_current_package_info = function(callback) {
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
 * The installer calls this function with the path to it's options file.
 * The options file
 **/
commander
      .option('-c, --configure <from_path>', 'Configure installation')
      .parse(process.argv);

if (commander.configure) {
  check_prey_dir(commander.configure,function(err,version) {

    if (err) {
      _tr(inspect(err));
      process.exit(1);
    }
    
    //set globals now we know the install dir ...
    pathToPrey = commander.configure;

    // initialise the prey global vars like _ns as the hooks files depends on provider system
    // should probably remove this dependency ...
    require(pathToPrey + '/lib');
    
    os_hooks = require(pathToPrey + '/scripts/' + platform + '/hooks');

    check_etc_dir(function(err) {
      _tr('Installing Prey version '+version);
      create_new_version(pathToPrey,function(err) {
        if (!err) {
          _tr('doing post_intall for '+platform);
          _tr('os_hooks is '+inspect(os_hooks));
          os_hooks.post_install(function(err) {
             if (err) {
              console.log(inspect(err));
            }
            
            _tr('exiting ... ');
            process.exit((err) ? 1 : 0);
           
          });
        }
      });
    });
  });
}

