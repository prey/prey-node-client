"use strict";

//////////////////////////////////////////
// Prey JS FileRetrieval
// (C) 2019 Prey, Inc.
// by Mauricio Schneider and Javier Acuña - http://preyproject.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs          = require('fs'),
    path        = require('path'),
    needle      = require('needle'),
    common      = require('./../../common'),
    files       = require('./storage'),
    Emitter     = require('events').EventEmitter;

var system      = common.system,
    run_as_user = common.system.run_as_user,
    node_bin    = path.join(system.paths.current, 'bin', 'node'),
    os_name     = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    logger      = common.logger;

var config   = common.config,
    protocol = config.get('control-panel.protocol'),
    host     = config.get('control-panel.host'),
    url      = protocol + '://' + host;

var UPLOAD_SERVER = url + '/upload/upload';

var em,
    cp;

var path_arg,
    name_arg;

// check_pending_files is used to resume any files that might been pending. It's called from
// filesagent/providers/network.

var retrieve_file_as_user = function(options, cb) {
  if (os_name == 'windows') {
    path_arg = path.resolve(options.path);
    name_arg = path.resolve(options.name);
  } else {
    path_arg = '"' + options.path + '"';
    name_arg = '"' + options.name + '"';
  }
  var opts = {
    user: options.user,
    bin: node_bin,
    type: 'exec',
    args: [path.join(__dirname, 'upload.js'), path_arg, options.user, name_arg, options.size, options.file_id, options.total, options.port],
    opts: {
      env: process.env
    }
  };

  run_as_user(opts, function(err, out) {
    if (err) {
      logger.error("Upload error: " + err.message);
      return;
    }
    logger.info("Ran as user: " + out);
    if (out.indexOf("File succesfuly uploaded") != -1) {
      files.del(options.file_id);
      return;
    }
    if (out.includes("EPIPE") || out.includes("EACCES")) {
      files.update(options.file_id, options.path, options.size, options.user, options.name, options.resumable, function(err) {
        if (err) logger.error("Database update error");
        logger.info("Resume file option activated for ID: " + options.file_id);
      });
    }
  });
}

exports.check_pending_files = function() {
  files.run_stored(host);
}

exports.start = function(id, options, cb) {
  
  var url = UPLOAD_SERVER + '?uploadID=' + options.file_id;
  // Make a call to get the last byte processed by the upload server
  // in order to resume the upload from that position.
  needle.request('get', url, null, function(err, res) {
    if (err) {
      console.log(err);
      return;
    }
    if (res.statusCode == 404) {
      files.del(options.file_id);
      return;
    }
    var data = JSON.parse(res.body);
    var file_status = JSON.parse(res.body).Status
    options.total = data.Total;

    if (file_status == 0 || file_status == 4) { // File in progress(0) or Pending(4)  
      files.exist(options.file_id, function(err, exist) {
        if (!exist) {
          options.resumable = false;
          options.total = 0;
          files.store(options.file_id, options.path, options.size, options.user, options.name, options.resumable);
          retrieve_file_as_user(options);

        } else {
          setTimeout(function() {
            if (options.resumable) {
              files.update(options.file_id, options.path, options.size, options.user, options.name, options.resumable, function(err) {
                if (err) logger.error("Database update error");
                logger.info("Resume file option deactivated for ID: " + options.file_id);
                retrieve_file_as_user(options);
              });
            }
          }, 2000);
        }
      })

    } else {
      if (file_status == 1) 
        logger.debug("File already uploaded, deleting from db...");
      else 
        logger.debug("File cancelled or with an error, deleting from db...");
      files.del(options.file_id);
      return;
    }
  })

  em = em || new Emitter();

  if (cb) cb(null, em);
  em.emit('end', id);
}

exports.stop = function() {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
}
