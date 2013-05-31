"use strict";

//////////////////////////////////////////
// Prey Files Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
    finder = require('./../../../utils/finder');

// returns list of recently modified files. unless since option is passed,
// will return list of modified since one hour ago
exports.get_recently_modified_list = function(options, callback){
  var callback = (typeof options == 'function') ? options : callback,
      options = options || {};

  var path = options.path || process.env.HOME,
      modified_since = new Date() - (options.since || 1000 * 60 * 60); // one hour ago

  var criteria = function(file, stat){
    return stat.mtime.getTime() > modified_since;
  };

  // console.log("Searching files on " + path + " modified after " + modified_since);
  get_list({path: path, criteria: criteria}, callback);

};

exports.matching_filename_list = function(options, callback){

  if (!options.string)
    return callback(new Error("No search string given"));

  var path = options.path || process.env.HOME;
  var search_string = options.string || options.search_string;
  var extensions = options.extensions || ".*";
  var modifiers = options.case_sensitive ? '' : 'i';

  var regex = new RegExp(".*" + search_string + ".*\." + extensions, modifiers);

  var criteria = function(file){
    return regex.test(file);
  };

  get_list({path: path, criteria: criteria}, callback);

};

var get_list = function(options, callback){

  var path = options.path || process.env.HOME,
      matches_criteria = options.criteria,
      matches = [];

  fs.exists(path, function(exists){
    if (!exists) return callback(new Error("Path not found: " + path));

    finder.eachFileOrDirectory(path, function(err, file, stat) {

      // if we get a hidden file or error, skip to next
      if (err || /\/\./.test(file)) return;

      if(!stat.isDirectory() && matches_criteria && matches_criteria(file, stat)) {
        // console.log("File matches criteria: " + file)
        matches.push(file);
      }
    }, function(){
      callback(null, matches);
    });
  });

};
