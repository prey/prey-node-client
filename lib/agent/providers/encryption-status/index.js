"use strict";

//////////////////////////////////////////
// (C) 2020 Prey, Inc.
// By Javier Acuña - http://preyproject.com
// GPLv3 Licensed
////////////////////////////////////////////

var common     = require('./../../common'),
    commands   = require('./../../commands'),
    logger     = common.logger.prefix('encryption'),
    system     = common.system,
    processing = false;

exports.scheduled = false;
exports.timeout = 10 * 60 * 1000  // Every 10 minutes

module.exports.get_encryption_status = function(cb) {
  logger.info("Getting encryption status");
  system.get_as_admin_user('encryptStatus', (err, info) => {
    if (err) return cb(err);
    if (!Array.isArray(info)) return cb(new Error("Invalid encryption status information"));

    // Schedule another status fetch if there's at least one disk encrypting or decrypting.
    processing = false;
    info.forEach((disk) => {
      if (disk.volumeStatus != "FullyDecrypted" && disk.volumeStatus != "FullyEncrypted" && disk.volumeStatus != "None") {
        processing = true;
      }
    })

    if (processing) {
      if (!exports.scheduled) {
        exports.scheduled = true;
        setTimeout(() => {
          exports.scheduled = false;
          commands.perform({command: 'get', target: 'encryption_status'})
        }, exports.timeout)
      }
    } else {
      exports.scheduled = false;
      processing = false;
    }
    return cb(null, JSON.stringify(info))
  })
}
