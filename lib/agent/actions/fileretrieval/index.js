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
    logger = common.logger,
    os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');

var em,
    cp;

var UPLOAD_SERVER = 'http://solid.preyproject.com/upload/upload';

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
    needle.request('get', url, null, function(err, res) {
      var data = JSON.parse(res.body);
      file.total = data.Total;
      get_file(file, cb);
    })
    return;
  }
  get_file(file, cb);
}

function get_file(file, cb) {
  var buf = new Buffer(file.size - file.total);
  var fd = fs.openSync(file.path, "r");

  fs.read(fd, buf, 0, file.size - file.total, file.total, function(err, read, buf) {
    upload_file(file, buf, cb);
  })
}

function upload_file(file, buf, cb) {
  var options = {
    open_timeout: 180000,
    read_timeout: 5000
  };
    
  if (file.total > 0) {
    options.headers = {
      'X-Prey-Upload-Resumable': file.total
    }
  }
  var url = UPLOAD_SERVER + '?uploadID='+file.id;
  needle.post(url, buf, options, function(err, res) {
    if (err) return em.emit(err);
    var out = res.statusCode;
    if (out !== 200) em.emit(new Error('There was an error communicating with the server'));
    cb();
  })
  em.emit('end');
}

exports.stop = function() {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
}
