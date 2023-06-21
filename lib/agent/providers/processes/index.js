"use strict";

//////////////////////////////////////////
// Prey Process List Provider
// (c) 2011 - Fork Ltd.
// By Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    os_functions = require('./' + osName),
    is_windows = osName == 'windows';

exports.get_process_list = os_functions.get_process_list;

/**
 *
 **/
exports.get_parent_process_list = function(callback) {
  var root_process_id = 1;

  exports.get_process_list(function(err, list) {
    if (err) return callback(err);

    var parents = [];

    list.forEach(function(p) {
      if (is_windows || (p.ppid === root_process_id))
        parents.push(p);
    });

    callback(null, parents);
  });
};

exports.get_user_process_list = function(cb) {

  var master_process_id = 1;

  exports.get_process_list(function(err, list) {
    if (err) return callback(err);

    if (is_windows) {
      var master_process = list.filter(function(p) { return p.name == 'services.exe' });
      if (master_process[0]) master_process_id = master_process[0].pid;
    }

    var user_list = [];

    list.forEach(function(p) {
      if (p.ppid !== 0 && p.ppid !== master_process_id && p.pid != master_process_id)
        user_list.push(p);
    });

    cb(null, user_list);
  });
};