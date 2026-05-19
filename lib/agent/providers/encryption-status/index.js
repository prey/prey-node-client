/// ///////////////////////////////////////
// (C) 2020 Prey, Inc.
// By Javier Acuña - http://preyproject.com
// GPLv3 Licensed
/// /////////////////////////////////////////

const common = require('../../common');
const commands = require('../../commands');
const config = require('../../../utils/configfile');

const logger = common.logger.prefix('encryption');
const { system } = common;
let processing = false;

exports.scheduled = false;
exports.timeout = 10 * 60 * 1000; // Every 10 minutes

exports.get_encryption_status = function (cb) {
  const osName = require('os').platform().replace('win32', 'windows').replace('darwin', 'mac');
  if (osName !== 'windows') {
    return typeof cb === 'function' && cb(new Error('Action only allowed on Windows'));
  }
  logger.info('Getting encryption status');
  system.get_as_admin_user('encryptStatus', (err, info) => {
    if (err) return cb(err);
    if (!Array.isArray(info)) {
      const invalidEncStatusError = new Error('Invalid encryption status information');
      invalidEncStatusError.extra = {
        infoError: JSON.stringify(info),
      };
      return cb(invalidEncStatusError);
    }
    // Schedule another status fetch if there's at least one disk encrypting or decrypting.
    processing = false;
    info.forEach((disk) => {
      if (disk.volumeStatus != 'FullyDecrypted' && disk.volumeStatus != 'FullyEncrypted' && disk.volumeStatus != 'None') {
        processing = true;
      }
    });

    if (processing) {
      if (!exports.scheduled) {
        exports.scheduled = true;
        setTimeout(() => {
          exports.scheduled = false;
          if (config.getData('control-panel.send_encryption_keys') !== false) {
            commands.perform({ command: 'get', target: 'encryption_status' });
          }
        }, exports.timeout);
      }
    } else {
      processing = false;
    }
    return cb(null, JSON.stringify(info));
  });
};
