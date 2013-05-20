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
    path  = require('path');

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
};
