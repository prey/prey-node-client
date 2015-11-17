"use strict";

//////////////////////////////////////////
// Prey Files Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
    path = require('path'),
    common = require('./../../common'),
    system  = common.system,
    node_bin = path.join(system.paths.current, 'bin', 'node'),
    run_as_user = common.system.run_as_user,
    finder = require('./finder'),
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

function get_home() {
  return process.env.HOME || process.env.HOMEDIR || process.env.USERPROFILE;
}

// returns list of recently modified files. unless since option is passed,
// will return list of modified since one hour ago
exports.get_files_recently_modified_list = function(options, callback) {

  var callback = (typeof options == 'function') ? options : callback,
      options = options || {};

  var path = options.path || get_home(),
      modified_since = new Date() - (options.since || 1000 * 60 * 60); // one hour ago

  var criteria = function(file, stat) {
      return stat.mtime.getTime() > modified_since;
  };

  // console.log("Searching files on " + path + " modified after " + modified_since);
  get_list({
    path: path,
    criteria: criteria
  }, callback);

};

exports.get_files_matching_filename_list = function(options, callback) {

  if (!options.string)
    return callback(new Error('No search string given.'));

  var path = options.path || get_home();
  var search_string = options.string || options.search_string;
  var extensions = options.extensions || ".*";
  var modifiers = options.case_sensitive ? '' : 'i';

  var regex = new RegExp(".*" + search_string + ".*\." + extensions, modifiers);

  var criteria = function(file) {
    return regex.test(file);
  };

  get_list({
    path: path,
    criteria: criteria
  }, callback);

};

var get_list = function(options, callback) {

  var path = options.path,
      matches_criteria = options.criteria,
      matches = [];

  if (!path)
    return cb(new Error('Cannot find files without a path.'));

  fs.exists(path, function(exists) {
    if (!exists)
      return callback(new Error("Path not found: " + path));

    finder.eachFileOrDirectory(path, function(err, file, stat) {

      // if we get a hidden file or error, skip to next
      if (err || /\/\./.test(file)) return;

      if (!stat.isDirectory() && matches_criteria && matches_criteria(file, stat)) {
        // console.log("File matches criteria: " + file)
        matches.push(file);
      }
    }, function() {
      callback(null, matches);
    });
  });

};

module.exports.get_tree = function(options, cb) {

  var path = options.path;

  // We need to run the tree walker script personifying
  // the owner of the corresponding /Users or /home subdirectories
  if (os_name !== 'windows' && !options.user) {
    cb(new Error('Options should specify user.'));
  }

  if (!path) {
    switch (os_name) {
      case 'windows':
        path = 'C:\\';
        break;
      case 'linux':
        path = '/home/'+ options.user;
        break;
      case 'mac':
        path = '/Users/' + options.user;
    }
  } else {
    // TODO validate if path is children of user's home dir
  }

  var opts = {
        user: options.user,
        bin: node_bin,
        type: 'exec',
        args: [path.join(__dirname, 'tree.js'), path], // TODO get path to walk from req or default to user's home
        opts: { env: process.env }
      }

  var cp = run_as_user(opts, function(err, out) {
    if (err) return cb(err);
    // TODO process output
  });
}

exports.get_file = function() {}
