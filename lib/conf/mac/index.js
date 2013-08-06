var fs     = require('fs'),
    path   = require('path'),
    exec   = require('child_process').exec,
    system = require('./../../system');

var running_user   = 'prey',
    launchdaemons_path = '/Library/LaunchDaemons',
    launchd_name   = 'com.prey.agent',
    launchd_plist  = launchd_name + '.plist',
    root_path      = system.paths.current,
    bin_path       = system.paths.current_bin;

var launchd_plist_path = launchdaemons_path + '/' + launchd_plist;

var debug = false;

//////////////////////////////////////////////////////
// helper functions
//////////////////////////////////////////////////////

var log = function(str) {
  if (debug)
    log(str);
}

var copy_plist = function(cb){
  fs.readFile(__dirname + '/' + launchd_plist, function(err, plist){
    if (err) return cb(err);

    var data = plist.toString()
               .replace(/{{root_path}}/g, root_path)
               .replace(/{{prey_bin}}/g, bin_path)
               .replace(/{{user}}/g, running_user);

    if (data === plist.toString())
      return cb(new Error("Unable to replace variables in plist template!"))

    fs.chmod(bin_path, 0755, function(err){
      if (err) return cb(err);

      fs.writeFile(launchd_plist_path, data, cb);
    });

  });
};

/*
var is_plist_loaded = function(cb) {
  exec('launchctl list', function(err, stdout){
    if (err) return cb(err);
    var bool = stdout.toString().match(launchd_plist) ? true : false;
    cb(null, bool);
  })
}
*/

var load_plist = function(cb) {
  call_launchctl('load', function(err) {
    if (err) return cb(err);
    call_launchctl('start', cb);
  });
}

var unload_plist = function(cb) {
  call_launchctl('unload', cb);
}

var remove_plist = function(cb) {
  fs.unlink(launchd_plist_path, cb);
}

var call_launchctl = function(command, cb) {
  var arg = command === 'start' ? launchd_name : launchd_plist_path;

  exec('launchctl ' + command + ' ' + arg, function(err, stdout, stderr){
    if (stdout.length > 0) log(stdout.toString());
    cb(err);
  });
}

var unload_remove = function(cb) {
  log('Removing launchd script...');

  fs.exists(launchd_plist_path, function(exists){
    if (!exists) {
      log("Launchd script already removed. Skipping...");
      return cb();
    }

    unload_plist(function(err){
      if (err) return cb(err);

      log("Prey launchd script unloaded. Removing file...");
      remove_plist(cb)
    })

  })
}

//////////////////////////////////////////////////////
// the actual hooks
//////////////////////////////////////////////////////

exports.post_install = function(cb){
  unload_remove(function(err) {
    log('Setting up launchd script...');

    copy_plist(function(err){
      if (err) return cb(err);

      log("Launchd script copied. Loading it...");
      load_plist(cb);
    })
  })
}

exports.pre_uninstall = function(cb){
  unload_remove(cb);
}

exports.post_activate = function (cb) {
  cb();
}
