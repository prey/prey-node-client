"use strict";

//////////////////////////////////////////
// Prey JS FileRetrieval
// (c) 2015 - Fork Ltd.
// by Mauricio Schneider - http://preyproject.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
    path = require('path'),
    api = require('./../../plugins/control-panel/api'),
    EventEmitter = require('events').EventEmitter;

var common = require('./../../common'),
    system = common.system,
    node_bin = path.join(system.paths.current, 'bin', 'node'),
    run_as_user = common.system.run_as_user,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var em,
    cp;

exports.start = function(options, cb) {
  var file_path = options.path,
      user = options.user;

  em = em || new EventEmitter();
  cb(null, em);
  retrieve_file(file_path, user);
}

function retrieve_file(file_path, user) {
  // We need to run the tree walker script personifying
  // the owner of the corresponding /Users or /home subdirectories
  if (os_name !== 'windows' && !user) {
    return em.emit('error', new Error('Options should specify user.'));
  }

  var opts = {
    user: user,
    bin: node_bin,
    type: 'exec',
    args: [path.join(__dirname, 'send_file.js'), '"' + file_path + '"'],
    opts: {
      env: process.env
    }
  };

  cp = run_as_user(opts, function(err, out) {
    if (err) return em.emit(err);
    if (out !== 200) em.emit(new Error('There was an error communicating with the server'));

    em.emit('end');
  });


}

exports.stop = function() {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
}
