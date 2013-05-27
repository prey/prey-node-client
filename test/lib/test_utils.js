/**
 *  TEST LIBRARY
 *
 *  Prey Client
 *
 *  Generic Functions
 *
 */

// Module requirements
var fs        = require('fs'),
    path      = require('path'),
    os_name   = process.platform === 'darwin' ? 'mac' : 'linux',
    exec      = require('child_process').exec,
    spawn     = require('child_process').spawn;

// Module variables
var utils = module.exports = function () {};

/**
 * @param   {String}    path
 * @param   {Callback}  cb
 *
 * @summary Recursively delete a directory
 */
utils.rmdir_sync_force = function (path) {
  var files, file, fileStats, i, filesLength;
  if (path[path.length - 1] !== '/') {
    path = path + '/';
  }

  files = fs.readdirSync(path);
  filesLength = files.length;

  if (filesLength) {
    for (i = 0; i < filesLength; i += 1) {
      file = files[i];

      fileStats = fs.statSync(path + file);
      if (fileStats.isFile()) {
        fs.unlinkSync(path + file);
      }
      if (fileStats.isDirectory()) {
        utils.rmdir_sync_force(path + file);
      }
    }
  }
  fs.rmdirSync(path);
}

/**
 * @param   {String}   iface
 * @summary Makes active network interface down
 */
utils.make_network_down = function (iface) {
  var iface_down = spawn('ifconfig', [iface, 'down']);
}

/**
 * @param   {String}    iface
 * @summary Makes active network interface up
 */
utils.make_network_up = function (iface) {
  var iface_up = spawn('ifconfig', [iface, 'up']);
}

/**
 * @param   {Callback}    callback
 * @summary Gets a username from the system different than root
 */
utils.get_non_root_user_id = function (callback) {
  var command;

  if (os_name === 'mac') {
    command = 'dscl . -list /Users UniqueID'
            + ' | grep -Ev "^_|daemon|nobody|root|Guest"'
            + ' | tail -1'
            + ' | awk \' { print ( $(NF) ) }\'';
  } else { // linux
    command =  'id -u $(cat /etc/passwd | grep -E "home.*bash" | tail -1 | cut -d":" -f1)';
  }

  exec(command, function (error, stdout, stderr) {
    return callback(parseInt(stdout));
  });
}

/**
 * @param   {Callback}    callback
 * @summary Returns in the callback the number of users the system has
 */
utils.count_users_in_system = function (callback) {
  var command;

  if (os_name === 'mac') {
    command = 'dscl . -list /Users'
            + ' | grep -Ev "^_|daemon|nobody|root|Guest"'
            + ' | wc -l'
            + ' | awk \' { print ( $(NF) ) }\'';
  } else { // linux
    command =  'cat /etc/passwd | grep -E "home.*bash" | wc -1 | awk \' { print ( $(NF) ) }\'';
  }

  exec(command, function (error, stdout, stderr) {
    return callback(parseInt(stdout));
  });
}
