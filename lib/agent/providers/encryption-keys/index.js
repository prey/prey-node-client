"use strict";

//////////////////////////////////////////
// (C) 2020 Prey, Inc.
// By Javier Acuña - http://preyproject.com
// GPLv3 Licensed
////////////////////////////////////////////

var common     = require('../../../common'),
    commands   = require('./../../commands'),
    logger     = common.logger.prefix('encryption'),
    system     = require('../../../system'),
    processing = false;

exports.scheduled = false;
exports.timeout = 2 * 60 * 60 * 1000;  // Every 2 hours

module.exports.get_encryption_keys = function(cb) {
  logger.info("Getting encryption keys");
  system.get_as_admin_user('recoveryKeys', (err, info) => {
    if (err) return cb(err);
    if (!Array.isArray(info)) return cb(new Error("Invalid encryption keys information"));

    // Schedule another keys fetch if there's at least one disk encrypted.
    processing = false;
    info.forEach((disk) => {
      if (disk.diskStatus == "encrypted" || disk.diskStatus == "locked") {
        processing = true;
      }
    })

    if (processing) {
      if (!exports.scheduled) {
        exports.scheduled = true;
        setTimeout(() => {
          exports.scheduled = false;
          commands.perform({command: 'get', target: 'encryption_keys'})
        }, exports.timeout)
      }
    } else {
      processing = false;
    }

    return cb(null, JSON.stringify(info));
  })
}