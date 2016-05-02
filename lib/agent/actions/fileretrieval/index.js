"use strict";

//////////////////////////////////////////
// Prey JS FileRetrieval
// Sign as 2016 - Prey, Inc.
// by Mauricio Schneider - http://preyproject.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
    path = require('path'),
    mime = require('mime'),
    needle = require('needle'),
    join = require('path').join,
    api = require('./../../plugins/control-panel/api'),
    files = require('./files_storage'),
    EventEmitter = require('events').EventEmitter;

var common = require('./../../common'),
    system = common.system,
    node_bin = path.join(system.paths.current, 'bin', 'node'),
    run_as_user = common.system.run_as_user,
    logger = common.logger,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var em,
    cp;

exports.check_pending_files = function() {
  files.run_stored();
}

exports.start = function(options, cb) {
  var file_path = options.path,
      user = options.user,
      file_id = options.file_id;

  em = em || new EventEmitter();
  if (cb) cb(null, em);

  files.store(file_id, file_path, user); 
  
  files.show();

  retrieve_file(file_path, user, file_id, options.resumable, function() {
    console.log("REMOVE CALLBACK FOR", file_id);
    files.del(file_id);
  });
}

function retrieve_file(file_path, user, file_id, resumable, cb) {
  // We need to run the tree walker script personifying
  // the owner of the corresponding /Users or /home subdirectories
  if (os_name !== 'windows' && !user) {
    return em.emit('error', new Error('Options should specify user.'));
  }

  var options = {
    multipart: true,
    open_timeout: 180000
  },
    url = 'http://solid.preyproject.com/upload/upload?uploadID='+file_id;

  var total = 0;

  if (resumable) {
    needle.request('get', url, null, function(err, res) {
      console.log("EN RESUMABLE:", err, res.body);

      var data = JSON.parse(res.body);
      total = data.Total;
    })
  }

  var data = {
    file: { file: file_path, content_type: mime.lookup(path.basename(file_path)) },
    path: file_path
  }

  // if (total > 0) {
  //   options.headers = {
  //     'X-Prey-Upload-Resumable': total
  //   }
  // }

  needle.post(url, data, options, function(err, res) {
    if (err) return em.emit(err);
    var out = res.statusCode;
    if (out !== 200) em.emit(new Error('There was an error communicating with the server'));
    cb();
  });
  em.emit('end');
}

exports.stop = function() {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
}
