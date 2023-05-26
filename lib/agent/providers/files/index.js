"use strict";

//////////////////////////////////////////
// Prey Files Provider
// (C) 2019 Prey, Inc.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs       = require('fs'),
    path     = require('path'),
    execSync = require("child_process").execSync;

var common      = require('./../../common'),
    system      = common.system,
    logger      = common.logger.prefix('files'),
    node_bin    = path.join(system.paths.current, 'bin', 'node'),
    run_as_user = common.system.run_as_user,
    finder      = require('./finder'),
    os_name     = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var MAX_BUFFER = 20*1024*1024;

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
    return callback(new Error('Cannot find files without a path.'));

  let exists = fs.existsSync(path)
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
};

module.exports.get_tree = function(options, cb) {

  var dir = options.path;

  // We need to run the tree walker script personifying
  // the owner of the corresponding /Users or /home subdirectories
  if (os_name !== 'windows' && !options.user) {
    cb(new Error('Options should specify user.'));
  }

  if (!dir) {
    switch (os_name) {
      case 'windows':
        dir = 'C:';
        break;
      case 'linux':
        dir = '/home/' + options.user;
        break;
      case 'mac':
        dir = '/Users/' + options.user;
        break;
    }
  } else {
    // TODO validate if path is children of user's home dir
  }

  var argsv; 
  if (os_name == 'windows')
    argsv = [path.join(__dirname, 'tree.js'), options.depth, path.resolve('', dir + '\\')];
  else
    argsv = [path.join(__dirname, 'tree.js'), options.depth, '"' + dir + '"'];
  
  var opts = {
    user: options.user,
    bin: node_bin,
    type: 'exec',
    args: argsv,
    opts: {
      maxBuffer: MAX_BUFFER,
      env: process.env
    }
  };

  var cp = run_as_user(opts, function(err, out) {
    if (err) return cb(err);

    try {
      var files = JSON.parse(out);
    } catch (e) {
      return cb(new Error('Unable to parse files data'));
    }

    if (files.length == 0) {
      logger.info("without files in folder!");
      return cb(null, "[]");
    }

    files.forEach((file, index) => {
      var done = (isHidden) => {
        file.hidden = isHidden;
        if (index == files.length - 1) {
          out = JSON.stringify(files);
          logger.debug(out);
          return cb(null, out);
        }
      }

      if (os_name == 'windows') {
        try {
          var stdout = execSync("cscript " + __dirname + "/attr.js " + file.path + " //Nologo");
          if (stdout.toString().includes('Error')) return done(false);
          stdout = JSON.parse(stdout);
          return done(stdout.hidden);

        } catch(e) {
          done(false);
        }
      }
      else done((/(^|\/)\.[^\/\.]/g).test(file.name));
    })  
  });
}

exports.get_file = function() {}