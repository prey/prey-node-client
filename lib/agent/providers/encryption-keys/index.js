"use strict";

//////////////////////////////////////////
// (C) 2020 Prey, Inc.
// By Javier Acuña - http://preyproject.com
// GPLv3 Licensed
////////////////////////////////////////////

var common = require('./../../common'),
    logger = common.logger.prefix('encryption'),
    system = common.system;

module.exports.get_encryption_keys = function(cb) {
  logger.info("Getting encryption keys");
  system.get_as_admin_user('recoveryKeys', (err, info) => {
    if (err) return cb(err);

    return cb(null, JSON.stringify(info));
  })
}