var fs = require('fs');

/**
 * Validates that a given path is a path to a Prey installation dir, callsback the prey version if successful.
 **/
exports.find = function(path, callback) {
  fs.exists(path, function(exists) {
    if (!exists) return callback(_error(path + ' does not exist'));

    fs.stat(path, function(err, stat) {
      if (err) return callback(_error(err));

      if (!stat.isDirectory())
        return callback(_error(path + ' is not a directory'));

      read_package_info(path, function(err) {
        if (err) return callback(_error(err));

        callback(null, path);
      });
    });
  });
};

/**
 * Read the versions directory.
 **/
var read_versions = function(callback) {
  // first check to see if versions dir exists, if not create it
  utils.dir.ensure(_versions_dir,function(err) {
    if (err) return callback(_error(err));

    fs.readdir(_versions_dir,function(err,dirs) {
      if (err) return callback(_error(err));

      callback(null,dirs.map(function(d) {
        return _versions_dir + '/'+d;
      }));
    });
  });
};

/**
 * Create the symlink to the current prey version.
 **/
var create_symlink = function(newVersion,callback) {
  var current = _install_dir + '/current';

  var make_link = function() {
    // junction only applicable on windows (ignored on other platforms)
    fs.symlink(newVersion,current,'junction',function(err) {
      if (err) {
        if (err.code === 'EACCES') {
          _tr('You should be running under root.');
        }
        return callback(_error(err));
      }

      _tr('Symlink updated');
      callback(null);
    });
  };

  // first check for existence of link ...
  fs.lstat(current,function(err) {
    if (err) {
      if (err.code === 'ENOENT') {
        // doesn't exist make it ...
        return make_link();
      } else {
        // unknown error ...
        return callback(_error(err));
      }
    }

    // otherwise the link exists, need to remove and recreate ...
    fs.unlink(current,function(err) {
      if (err) {
        if (err.code === 'EACCES') {
          _tr('You should be running under root.');
        }
        return callback(_error(err));
      }

      make_link();
    });
  });
};

/**
 * Update the global prey symlink to point to the newly installed version.
 **/
var create_new_version = function(newVersion,callback) {
  create_symlink(newVersion,function(err) {
    if (err) return callback(_error(err));
    callback(null);
  });
};

/**
 * Get path to version directory.
 **/
var get_current_version_path = function(callback) {
  var current = _install_dir + '/current';
  fs.readlink(current,function(err,realDir) {
    if (err) return callback(_error(err));

    callback(null,realDir);
  });
};

/**
 * Get package info from a prey installation dir.
 **/
var read_package_info = function(path, callback) {
  try {
    var info = require(path + '/package.json');
    callback(null, info);
  } catch(e) {
    callback(_error(e, path));
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
 * Select the current prey version, and initializes it's
 * namespaces.
 **/
var with_current_version = function(callback) {
  get_current_version_path(function(err,path) {
    if (err) return callback(_error(err));

    initialize_installation(path,function(err) {
      if (err) return callback(_error(err));
      callback(null,path);
    });
  });
};

/**
 * Iterate over versions
 **/
var each_version = function(callback) {
  read_versions(function(err,versions) {
   if (err) return callback(_error(err));

   versions.forEach(function(path) {
     read_package_info(path,function(err,info) {
       if (err) return callback(_error(err));

       callback(null,{pack:info,path:path});
     });
   });
  });
};

/**
 * Set the current version of Prey to run.
 * Always runs the os_hooks.post_install of the installation to make
 * sure that that versions init scripts are copied.
 **/
var set_version = function(version,callback) {
  _tr('1:Set version ...');
  var vp = _versions_dir + '/' + version;
  fs.exists(vp,function(exists) {
    if (!exists) exit_process('Versions '+version+' not installed.',1);

    create_symlink(vp,function(err) {
      if (err) return callback(_error(err));

      post_install(function(err) {
        if (err) exit_process(err,1);
        exit_process("Prey" + vp +' set',0);
      });
    });
  });
};
