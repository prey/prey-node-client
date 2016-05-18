"use strict";

//////////////////////////////////////////
// Prey JS FileRetrieval
// (C) 2016 Prey, Inc.
// by Mauricio Schneider and Javier Acuña - http://preyproject.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs           = require('fs'),
    path         = require('path'),
    mime         = require('mime'),
    common       = require('./../../common'),
    needle       = require('needle'),
    join         = require('path').join,
    files        = require('./storage'),
    Emitter      = require('events').EventEmitter;

var system      = common.system,
    run_as_user = common.system.run_as_user,
    node_bin    = path.join(system.paths.current, 'bin', 'node'),
    logger      = common.logger;

var em,
    cp;

// check_pending_files is used to resume any files that might been pending. It's called from
// filesagent/providers/network.
exports.check_pending_files = function() {
  files.run_stored();
}

exports.start = function(options, cb) {
  if (!options.resumable) {
    options.resumable = false;
  }
  var opts = {
    user: options.user,
    bin: node_bin,
    type: 'exec',
    args: [path.join(__dirname, 'upload.js'), '"' + options.path + '"', options.user, '"'+options.name+'"', options.size, options.file_id, options.resumable, options.port],
    opts: {
      env: process.env
    }
  };
  em = em || new Emitter();

  files.store(options.file_id, options.path, options.size, options.user, options.name);

  run_as_user(opts, function(err, out) {
    if (err) {
      logger.error("Upload error: " + err.message);
      return;
    }
    logger.info("Ran as user: " + out);
    if (out.indexOf("File succesfuly uploaded") != -1){
      files.del(options.file_id);
    }
  });
  if (cb) cb(null, em);
  em.emit('end');
}

exports.stop = function() {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
}
