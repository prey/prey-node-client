// from https://gist.github.com/814063

var fs = require("fs");

/**
 * Call fileHandler with the file name and file Stat for each file found inside
 * of the provided directory.
 *
 * Call the optionally provided completeHandler with an array of files (mingled
 * with directories) and an array of Stat objects (one for each of the found
 * files.
 *
 * Following is an example of a simple usage:
 *
 *   eachFileOrDirectory('test/', function(err, file, stat) {
 *     if (err) throw err;
 *     if (!stat.isDirectory()) {
 *       console.log(">> Found file: " + file);
 *     }
 *   });
 *
 * Following is an example that waits for all files and directories to be
 * scanned and then uses the entire result to do somthing:
 *
 *   eachFileOrDirectory('test/', null, function(files, stats) {
 *     if (err) throw err;
 *     var len = files.length;
 *     for (var i = 0; i < len; i++) {
 *       if (!stats[i].isDirectory()) {
 *         console.log(">> Found file: " + files[i]);
 *       }
 *     }
 *   });
 */
var eachFileOrDirectory = function(directory, fileHandler, completeHandler) {
  var filesToCheck = 0;
  var checkedFiles = [];
  var checkedStats = [];

  directory = (directory) ? directory : './';

  var fullFilePath = function(dir, file) {
    return dir.replace(/\/$/, '') + '/' + file;
  };

  var checkComplete = function() {
    if (filesToCheck == 0 && completeHandler) {
      completeHandler(null, checkedFiles, checkedStats);
    }
  };

  var onFileOrDirectory = function(fileOrDirectory) {
    filesToCheck++;
    fs.stat(fileOrDirectory, function(err, stat) {
      filesToCheck--;
      if (err) return fileHandler(err);
      checkedFiles.push(fileOrDirectory);
      checkedStats.push(stat);
      fileHandler(null, fileOrDirectory, stat);
      if (stat.isDirectory()) {
        onDirectory(fileOrDirectory);
      }
      checkComplete();
    });
  };

  var onDirectory = function(dir) {
    filesToCheck++;
    fs.readdir(dir, function(err, files) {
      filesToCheck--;
      if (err) return fileHandler(err);
      files.forEach(function(file, index) {
        file = fullFilePath(dir, file);
        onFileOrDirectory(file);
      });
      checkComplete();
    });
  }

  onFileOrDirectory(directory);
};

/**
 * Recursivly, asynchronously traverse the file system calling the provided
 * callback for each file (non-directory) found.
 *
 * Traversal will begin on the provided path.
 */
var eachFile = function(path, callback, completeHandler) {
  var files = [];
  var stats = [];

  eachFileOrDirectory(path, function(err, file, stat) {
    if (err) return callback(err);
    if (!stat.isDirectory()) {
      files.push(file);
      stats.push(stat);
      if (callback) callback(null, file, stat);
    }
  }, function(err) {
    if (err) return completeHandler(err);
    if (completeHandler) completeHandler(null, files, stats);
  });
};

/**
 * Works just like eachFile, but it only includes files that match a provided
 * regular expression.
 *
 *   eachFileMatching(/_test.js/, 'test', function(err, file, stat) {
 *     if (err) throw err;
 *     console.log(">> Found file: " + file);
 *   });
 *
 */
var eachFileMatching = function(expression, path, callback, completeHandler) {
  var files = [];
  var stats = [];

  eachFile(path, function(err, file, stat) {
    if (err) return callback(err);
    if (expression.test(file)) {
      files.push(file);
      stats.push(stat);
      if (callback) callback(null, file, stat);
    }
  }, function(err) {
    if (err) return completeHandler(err);
    completeHandler(null, files, stats);
  });
};

/**
 * Read each file with a file name that matches the provided expression
 * and was found in the provided path.
 *
 * Calls the optionally provided callback for each file found.
 *
 * Calls the optionally provided completeHandler when the search is
 * complete.
 *
 *   readEachFileMatching(/_test.js/, 'test', function(err, file, stat, content) {
 *     if (err) throw err;
 *     console.log(">> Found file: " + file + " with: " + content.length + " chars");
 *   });
 */
var readEachFileMatching = function(expression, path, callback, completeHandler) {
  var files = [];
  var contents = [];
  var stats = [];
  eachFileMatching(expression, path, function(err, file, stat) {
    fs.readFile(file, function(err, content) {
      if (err) return callback(err);
      files.push(file);
      contents.push(content);
      stats.push(stat);
      if (callback) callback(null, file, stat, content);
    });
  }, function(err) {
    if (err) return completeHandler(err);
    if (completeHandler) completeHandler(err, files, stats, contents);
  });

};

exports.eachFile = eachFile;
exports.eachFileMatching = eachFileMatching;
exports.eachFileOrDirectory = eachFileOrDirectory;
exports.readEachFileMatching = readEachFileMatching;
