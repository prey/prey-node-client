/**
 *  TEST LIBRARY
 *
 *  Prey Client
 *
 *  Generic Functions
 *
 */

// Module requirements
var fs    = require('fs'),
    path  = require('path'),
    spawn = require('child_process').spawn;

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
utils.make_network_down = function (iface, callback) {
  var iface_down = spawn('ifconfig', [iface, 'down']);
}

/**
 * @param   {String}    iface
 * @summary Makes active network interface up
 */
utils.make_network_up = function (iface, callback) {
  var iface_up = spawn('ifconfig', [iface, 'up']);
}
