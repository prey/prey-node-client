#!/usr/bin/env node

var fs       = require('fs'),
    path     = require('path'),
    mime     = require('mime'),
    common   = require('./../../common'),
    needle   = require('needle');

var config   = common.config,
    protocol = config.get('control-panel.protocol'),
    host     = config.get('control-panel.host'),
    url      = protocol + '://' + host;

var UPLOAD_SERVER    = url + '/upload/upload',
    RESUMABLE_HEADER = 'X-Prey-Upload-Resumable',
    OPEN_TIMEOUT     = 180000,
    READ_TIMEOUT     = 2000;

var PATH    = 2,
    USER    = 3,
    NAME    = 4,
    SIZE    = 5,
    FILE_ID = 6,
    TOTAL   = 7,
    PORT    = 8;

function main() {
  var argv = process.argv;
  var options = {
      path:    argv[PATH],
      user:    argv[USER],
      name:    argv[NAME],
      size:    argv[SIZE],
      file_id: argv[FILE_ID],
      total:   argv[TOTAL],
      port:    argv[PORT]
  }
  Main(options, function(err) {
    if (err) {
      console.log(err);
      return;
    }
  });
}

function Main(options, cb) {
  var file_path = options.path,
      file_id = options.file_id,
      file_size = parseInt(options.size),
      file_name = options.name,
      user = options.user;

  console.log("Uploading file: ", file_path, file_id);

  var file = {
    total: 0,
    path: file_path,
    user: user,
    id: file_id,
    size: file_size
  }
  get_file(file, cb);
}

function get_file(file, cb) {
  var buffsize = (file.size == 0) ? 1 : (file.size - file.total);
  var buf = new Buffer(buffsize); 
  var fd = fs.openSync(file.path, "r");

  fs.read(fd, buf, 0, file.size - file.total, file.total, function(err, read, buf) {
    if (err) {
      cb(err);
      return;
    }
    upload_file(file, buf, cb);
  })
}

function upload_file(file, buf, cb) {
  var options = {
    open_timeout: OPEN_TIMEOUT,
    read_timeout: READ_TIMEOUT
  }
  
  if (file.total > 0) {
    RESUMABLE_HEADER = file.total;
  }
  var url = UPLOAD_SERVER + '?uploadID=' + file.id;

  needle.post(url, buf, options, function(err, res) {
    if (err) {
      console.log(err);
      cb(err);
      return;
    }
    var out = res.statusCode;
    if (out !== 200 && out !== 201) {
      var err = new Error('There was an error communicating with the server');
      cb(err);
      return;
    }
    console.log("File succesfuly uploaded:", file.id);
    cb(null); // delete files
  })
}

main();