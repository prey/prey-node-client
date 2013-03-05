/**
 * Prey Node Client
 *
 * Configuration
 * Hooks
 * OS X
 *
 * Functions relative with the install / removal
 * of .plist file
 *
 */

var fs     = require('fs'),
    path   = require('path'),
    exec   = require('child_process').exec,
    system = require('./../../system');

// Hook configuration variables
var locals              = require('./hook_locals'),
    running_user        = locals.running_user,
    label               = locals.label,
    launchdaemons_path  = locals.launchdaemons_path,
    launchd_plist       = locals.launchd_plist,
    trigger_script      = locals.trigger_script,
    bin_path            = system.paths.current_bin;

var trigger_script_path = path.join(system.paths.current, 'bin', 'mac', trigger_script),
    launchd_plist_path  = launchdaemons_path + '/' + launchd_plist;

//////////////////////////////////////////////////////
// the hooks
//////////////////////////////////////////////////////

/**
 * @param   {Callback}  callback
 *
 * @summary Set up `prey-trigger.py` in launchd
 */
exports.post_install = function (callback) {
  console.log('Setting up launchd script...');

  remove_plist(removed_plist);

  function removed_plist (err) {
    if (err && err.code != 'ENOENT') return callback(err);
    copy_plist(copied_plist);
  }

  function copied_plist (err) {
    if (err) return callback(err);
    console.log("LaunchDaemon script copied. Loading it...");
    load_plist(callback);
  }
}

exports.pre_uninstall = function(callback){
  console.log('Removing launchd script...');
  fs.exists(launchd_plist_path, onQueryResponse);

  function onQueryResponse (exists) {
    if (!exists) {
      console.log("LaunchDaemon plist file already removed. Skipping...");
      return callback();
    }

    unload_plist(removedPlist);
  }

  function removedPlist (err) {
    if (err) return callback(err);
    console.log("Prey trigger unloaded. Removing plist...");
    remove_plist(callback);
  }
}

//////////////////////////////////////////////////////
// helper functions
//////////////////////////////////////////////////////

/**
 * @param   {Callback}  callback
 *
 * @summary Removes .plist file
 */
function remove_plist (callback) {
  fs.unlink(launchd_plist_path, callback);
}

/**
 * @param   {Callback}  callback
 *
 * @summary Adds .plist file into system
 */
function copy_plist (callback) {
  var plist = fs.readFileSync(__dirname + '/' + launchd_plist);
  var data = plist.toString()
    .replace('{{label}}', label)
    .replace('{{trigger_script}}', trigger_script_path)
    .replace('{{prey_bin}}', bin_path)
    .replace('{{user}}', running_user);

  if (data === plist.toString())
    return callback(new Error("Unable to replace variables in plist template!"))

  fs.chmod(trigger_script_path, 0755, function(err){
    if (err) return callback(err);
    fs.writeFile(launchd_plist_path, data, callback);
  });
}

/**
 * @param   {Callback}  callback
 *
 * @summary Adds .plist file into system
 */
function load_plist (callback) {
  call_launchctl('load', callback);
}

/**
 * @param   {Callback}  callback
 *
 * @summary Removes .plist file into system
 */
function unload_plist (callback) {
  call_launchctl('unload', callback);
}


/**
 * @param   {Callback}  callback
 *
 * @summary Checks whether .plist is loaded into system
 */
function is_plist_loaded (callback) {
  exec('launchctl list', onQueryResponse);

  function onQueryResponse (err, stdout) {
    if (err) return callback(err);
    var bool = stdout.toString.match(launchd_plist) ? true : false;
    callback(null, bool);
  }
}

/**
 * @param   {String}    command
 * @param   {Callback}  callback
 *
 * @summary Calls `launchctl` with the given command
 */
function call_launchctl (command, callback) {
  var execCommand = 'launchctl ' + command + ' ' + launchd_plist_path;
  exec(execCommand, executedCommand);

  function executedCommand (err, stdout, stderr) {
    if (stdout.length > 0) console.log(stdout.toString());
    callback(err);
  }
}
