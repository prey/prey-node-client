"use strict";

//////////////////////////////////////////
// Prey JS FileRetrieval
// Sign as 2016 - Prey, Inc.
// by Mauricio Schneider - http://preyproject.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
    path = require('path'),
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

  retrieve_file(file_path, user, file_id, function() {
    files.del(file_id);
  });
}

function retrieve_file(file_path, user, file_id, cb) {
  // We need to run the tree walker script personifying
  // the owner of the corresponding /Users or /home subdirectories
  if (os_name !== 'windows' && !user) {
    return em.emit('error', new Error('Options should specify user.'));
  }

  var opts = {
    user: user,
    bin: node_bin,
    type: 'exec',
    args: [path.join(__dirname, 'upload.js'), '"' + file_path + '"', file_id],
    opts: {
      env: process.env
    }
  };

  cp = run_as_user(opts, function(err, out) {
    if (err) return em.emit(err);
    if (out !== 200) em.emit(new Error('There was an error communicating with the server'));
    if (cb) cb(); // si es que el archivo se sube, llamar al callback
  });
  em.emit('end');
}

exports.stop = function() {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
}
