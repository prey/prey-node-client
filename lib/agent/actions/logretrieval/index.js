"use strict";

//////////////////////////////////////////
// Prey JS LogRetrieval
// (C) 2019 Prey, Inc.
// by Javier Acuña - http://preyproject.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs       = require('fs'),
    os       = require('os'),
    join     = require('path').join,
    async    = require('async'),
    archiver = require('archiver'),
    needle   = require('needle'),
    Emitter  = require('events').EventEmitter,
    common   = require('../../../common'),
    logger   = common.logger.prefix('logretrieval'),
    paths    = common.system.paths,
    osName  = process.platform.replace('win32', 'windows').replace('darwin', 'mac'),
    keys     = require('./../../control-panel/api/keys');

exports.tmpdir = osName == 'windows' ? process.env.WINDIR + '\\Temp' : '/tmp';

var config   = common.config,
    protocol = config.get('control-panel.protocol'),
    host     = config.get('control-panel.host'),
    url      = protocol + '://' + host;

var UPLOAD_URL   = url + '/upload/log',
    OPEN_TIMEOUT = 180000,
    READ_TIMEOUT = 2000;

var em, cp;

let CONFIG_PATH,
    LOG_PATH,
    COMMANDS_PATH,
    CONF_PATH,
    ROTATED_PATH,
    WINSVC_LOG,
    WINSVC_UPDATER,
    LOGS_ZIP_PATH;

var collect_files = (output_file, cb) => {

  var output = fs.createWriteStream(output_file);
  var archive = archiver('zip', {
    zlib: { level: 9 }
  });

  output.on('close', function() {
    let total_bytes = archive.pointer();
    return cb(null, total_bytes);
  });

  archive.on('error', cb)

  archive.pipe(output);

  let files = [
    { path: CONF_PATH,     name: 'prey.conf' },
    { path: LOG_PATH,      name: 'prey.log' },
    { path: COMMANDS_PATH, name: 'commands.db' },
    { path: ROTATED_PATH,  name: 'prey.log.1.gz' },
    ...(os.platform() == 'win32' ? [   // Only for windows add admin service logs
      { path: WINSVC_LOG,     name: 'winsvc.log' },
      { path: WINSVC_UPDATER, name: 'updater.log' },
    ]: [])
  ];

  var array = [];

  files.forEach((file) => {
    if (!fs.existsSync(file.path)) {
      return;
    }
    array.push((callback) => {
      var file_data;
      var rs = fs.createReadStream(file.path)
      rs.on('error', (err) => {
        callback();
      })

      rs.on('data', (data) => {
        if (file_data) file_data = file_data.toString().concat(data);
        else file_data = data;
      })

      rs.on('close', () => {
        archive.append(file_data, {name: file.name})
        callback();
      })
    });
  });

  async.series(array, (err) => {
    archive.finalize();
  })
}

var get_file = (file_path, file_size, cb) => {
  var buf = Buffer.alloc(file_size); 
  var fd = fs.openSync(file_path, "r");

  fs.read(fd, buf, 0, file_size, 0, function(err, read, buf) {
    if (err) return cb(err);
    cb(null, buf)
  })
}

exports.upload_zip = (file_path, bytes, cb) => {
  get_file(file_path, bytes, (err, buf) => {

    if (err) return cb(err);

    var apikey    = keys.get().api,
        devicekey = keys.get().device;

    var options = {
      user_agent: common.system.user_agent,
      open_timeout: OPEN_TIMEOUT,
      read_timeout: READ_TIMEOUT,
      username: apikey,
      password: 'x'
    }

    needle.post(`${UPLOAD_URL}?deviceKey=${devicekey}`, buf, options, function(err, res) {
      if (err) return cb(err);

      let out = res.statusCode;

      if (out !== 200 && out !== 201)
        return cb(new Error('There was an error uploading logs file'));

      logger.info("Log file succesfuly uploaded!");
      cb(null);
    });

  });
}

var done = (id, err) => {
  if (err) logger.info(err);
  em.emit('end', id, err);
}

exports.start = function(id, options, cb) {
  CONFIG_PATH    = paths.config;
  LOG_PATH       = paths.log_file;
  COMMANDS_PATH  = join(CONFIG_PATH, 'commands.db');
  CONF_PATH      = join(CONFIG_PATH, 'prey.conf');
  ROTATED_PATH   = join(CONFIG_PATH, 'prey.log.1.gz');
  WINSVC_LOG     = join(CONFIG_PATH, 'winsvc.log');
  WINSVC_UPDATER = join(CONFIG_PATH, 'updater.log');
  LOGS_ZIP_PATH  = join(exports.tmpdir, 'logs.zip');

  collect_files(LOGS_ZIP_PATH, (err, bytes) => {
    if (err) return done(id, err);

    exports.upload_zip(LOGS_ZIP_PATH, bytes, (err) => {
      return done(id, err);
    });
  });

  em = em || new Emitter();
  if (cb) cb(null, em)
}

exports.stop = function() {
  if (cp && !cp.exitCode) {
    cp.kill();
  }
}
