var fs     = require('fs'),
    path   = require('path'),
    exec   = require('child_process').exec,
    system = require('./../../system');

var running_user   = 'prey',
    launchdaemons_path = '/Library/LaunchDaemons',
    launchd_plist  = 'com.prey.trigger.plist',
    trigger_script = 'prey-trigger.py',
    bin_path       = system.paths.current_bin;

var trigger_script_path = path.join(system.paths.current, 'bin', 'mac', trigger_script),
    launchd_plist_path = launchdaemons_path + '/' + launchd_plist;

//////////////////////////////////////////////////////
// helper functions
//////////////////////////////////////////////////////

var copy_plist = function(callback){
  var plist = fs.readFileSync(__dirname + '/' + launchd_plist);
  var data = plist.toString()
    .replace('{{trigger_script}}', trigger_script_path)
    .replace('{{prey_bin}}', bin_path)
    .replace('{{user}}', running_user);

  if (data === plist.toString())
    return callback(new Error("Unable to replace variables in plist template!"))

  fs.chmod(trigger_script_path, 0755, function(err){
    if (err) return callback(err);
    fs.writeFile(launchd_plist_path, data, callback);
  });
};

var is_plist_loaded = function(callback){
  exec('launchctl list', function(err, stdout){
    if (err) return callback(err);
    var bool = stdout.toString.match(launchd_plist) ? true : false;
    callback(null, bool);
  })
}

var load_plist = function(callback){
  call_launchctl('load', callback);
}

var unload_plist = function(callback){
  call_launchctl('unload', callback);
}

var remove_plist = function(callback){
  fs.unlink(launchd_plist_path, callback);
}

var call_launchctl = function(command, callback){
  exec('launchctl ' + command + ' ' + launchd_plist_path, function(err, stdout, stderr){
    if (stdout.length > 0) console.log(stdout.toString());
    callback(err);
  })
}

//////////////////////////////////////////////////////
// the actual hooks
//////////////////////////////////////////////////////

exports.post_install = function(callback){
  console.log('Setting up launchd script...');

  remove_plist(function(err){
    if (err && err.code != 'ENOENT')
      return callback(err);

    copy_plist(function(err){
      if (err) return callback(err);

      console.log("LaunchDaemon script copied. Loading it...");
      load_plist(callback)
    })

  })

}

exports.pre_uninstall = function(callback){

  console.log('Removing launchd script...');
  fs.exists(launchd_plist_path, function(exists){

    if (!exists) {
      console.log("LaunchDaemon plist file already removed. Skipping...");
      return callback();
    }

    unload_plist(function(err){
      if (err) return callback(err);

      console.log("Prey trigger unloaded. Removing plist...");
      remove_plist(callback)
    })

  })

}
