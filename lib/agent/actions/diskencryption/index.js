var os       = require('os'),
    path     = require('path'),
    join     = path.join,
    Emitter  = require('events').EventEmitter,
    common   = require('../../common'),
    commands = require('../../commands'),
    logger   = common.logger.prefix('diskencryption'),
    system   = require('./../../../system');

var emitter,
    action;

var node_bin = join(system.paths.current, 'bin', 'node');

var error_status_list = {
  0: "Success!",
  1: "Unknown error",
  2: "No volume asociated",
  3: "Attempt to unlock a non locked disk",
  4: "Unable to change security stantard on a encrypted disk",
  5: "Unable to decrypt a locked disk",
  6: "Unable to encrypt a locked disk",
  7: "Incorrect unlock password",
  8: "Incorrect password format",
  9: "No access for lock",
  10: "Disk already locked",
  11: "Unrecognized setting"
}

var process_options = (options) => {
  var opts = [];

  options.disks.forEach(disk => {
    var disk_opts = []

    // encryption
    if (options.encryption) {
      disk_opts.push(disk)

      if (!options.full_disk)
        disk_opts.push("-UsedSpaceOnly")

      disk_opts.push("-EncryptionMethod", options.encryption_method)
      disk_opts.push("-RecoveryPasswordProtector", "-SkipHardwareTest")

      opts.push(disk_opts);
    }
    // decryption
    else {
      opts.push(disk)
    }
  })

  return opts;
}

exports.start = function(id, opts, cb) {
  var os_name = os.platform().replace('darwin', 'mac').replace('win32', 'windows');

  if (os_name != 'windows')
    return cb(new Error('Action only allowed on Windows 1O'));

  var opts = opts || {};
  if (!opts || opts.encryption == null || opts.encryption == undefined || !opts.disks || !Array.isArray(opts.disks))
    return cb(new Error("The encryption data is not valid"))

  if (!opts.full_disk) opts.full_disk = true;
  if (!opts.encryption_method) opts.encryption_method = "Aes128";

  var data = {
    key: "device-key",
    token: "token",
    logged: false,
    dirs: process_options(opts)
  }

  action = opts.encryption ? 'encrypt' : 'decrypt';

  var finished = function(err, out) {
    logger.info('Encryption Process initialized!');
    var output = null;

    if (!err) {
      commands.perform({command: 'get', target: 'encryption_status'})
      commands.perform({command: 'get', target: 'encryption_keys'})
      
      output = {}
      if (!out) return emitter.emit('end', id);

      out.forEach(disk => {
        var data = disk.disk.slice(0, -1);

        if (disk.error) {
          logger.warn("Error executing BitLocker process on disk " + data + ": " + error_status_list[disk.code]);
          output[data] = disk.code;
        }
        else output[data] = 0;
      })
    }

    if (!emitter) return;
    return emitter.emit('end', id, err, output);
  }

  emitter = new Emitter;
  cb(null, emitter);

  system.spawn_as_admin_user(node_bin, data, {}, function(err, child) {
    if (typeof child == 'function') {  // only for windows
      child(action, data, finished);
    } else {
      return finished(new Error("Admin service not available"));
    }
  })
}

exports.stop = function(){
  emitter = null;
}
