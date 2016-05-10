"use strict";

//////////////////////////////////////////
// Prey JS FileRetrieval
// (C) 2016 Prey, Inc..
// by Mauricio Schneider and Javier Acuña - http://preyproject.com
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

var common   = require('./../../common'),
    system   = common.system,
    config   = common.config,
    protocol = config._values['control-panel'].protocol,
    host     = config._values['control-panel'].host,
    url      = protocol + '://' + host
    node_bin = path.join(system.paths.current, 'bin', 'node'),
    logger   = common.logger,
    os_name  = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var em,
    cp;

var UPLOAD_SERVER = url + '/upload/upload',
    RESUMABLE_HEADER = 'X-Prey-Upload-Resumable',
    OPEN_TIMEOUT  = 180000,
    READ_TIMEOUT  = 5000;

exports.check_pending_files = function() {
  files.run_stored();
}

exports.start = function(options, cb) {
  var file_path = options.path,
      file_id = options.file_id,
      file_size = parseInt(options.size),
      user = options.user;

  em = em || new EventEmitter();
  if (cb) cb(null, em);

  if (!options.resumable)
    files.store(file_id, file_path, file_size, user);

  var file = {
    total: 0,
    path: file_path,
    user: user,
    id: file_id,
    size: file_size,
    resumable: options.resumable
  }

  retrieve_file(file, function() {
    files.del(file.id);
  });
}

function retrieve_file(file, cb) {
  if (file.resumable) {
    var url = UPLOAD_SERVER + '?uploadID=' + file.id;
    // Make a call to get the last byte processed by the upload server
    // before the disconnection in order to resume the upload from that position
    needle.request('get', url, null, function(err, res) {
      if (err) return em.emit(err);
      var data = JSON.parse(res.body);
      file.total = data.Total;
      get_file(file, cb);
    })
    return;
  }
  get_file(file, cb);
}

function get_file(file, cb) {
  var buffsize;
  if (file.size == 0)
    buffsize = 1;
  else
    buffsize = file.size - file.total;
  
  var buf = new Buffer(buffsize); 
  var fd = fs.openSync(file.path, "r");

  fs.read(fd, buf, 0, file.size - file.total, file.total, function(err, read, buf) {
    if (err) return em.emit(err);
    upload_file(file, buf, cb);
  })
}

function upload_file(file, buf, cb) {
  var options = {
    open_timeout: OPEN_TIMEOUT,
    read_timeout: READ_TIMEOUT
  };
    
  if (file.total > 0) {
    RESUMABLE_HEADER = file.total;
  }
  var url = UPLOAD_SERVER + '?uploadID='+file.id;
  needle.post(url, buf, options, function(err, res) {
    if (err) {
      logger.error(err)
      return em.emit(err);
    }
    var out = res.statusCode;
    if (out !== 200 && out !== 201) {
      var err = new Error('There was an error communicating with the server');
      logger.error(err)
      em.emit(err);
    } 
    cb();
  })
  em.emit('end');
}

exports.stop = function() {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
}
