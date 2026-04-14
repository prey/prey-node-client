/* eslint-disable consistent-return */
const os = require('os');
const common = require('../../common');
const commands = require('../../commands');
const config = require('../../../utils/configfile');

const logger = common.logger.prefix('encryption');
const osName = os.platform().replace('win32', 'windows').replace('darwin', 'mac');
const { system } = common;
let processing = false;

exports.scheduled = false;
exports.timeout = 2 * 60 * 60 * 1000; // Every 2 hours

module.exports.get_encryption_keys = (cb) => {
  if (osName === 'windows') {
    logger.info('Getting encryption keys');
    system.get_as_admin_user('recoveryKeys', (err, info) => {
      if (err) return cb(err);
      if (!Array.isArray(info)) {
        const invalidEncError = new Error('Invalid encryption keys information');
        invalidEncError.extra = {
          infoError: JSON.stringify(info),
        };
        return cb(invalidEncError);
      }

      // Schedule another keys fetch if there's at least one disk encrypted.
      processing = false;
      info.forEach((disk) => {
        if (disk.diskStatus === 'encrypted' || disk.diskStatus === 'locked') {
          processing = true;
        }
      });

      if (processing) {
        if (!exports.scheduled) {
          exports.scheduled = true;
          logger.info('>>> [send_encryption_keys] encryption-keys — scheduling re-fetch in 2h (disk still encrypted/locked)');
          setTimeout(() => {
            exports.scheduled = false;
            logger.info('>>> [send_encryption_keys] encryption-keys — 2h timeout fired');
            if (config.getData('control-panel.send_encryption_keys') !== false) {
              logger.info('>>> [send_encryption_keys] encryption-keys — re-fetching encryption_keys');
              commands.perform({ command: 'get', target: 'encryption_keys' });
            } else {
              logger.info('>>> [send_encryption_keys] encryption-keys — re-fetch SKIPPED (disabled by config)');
            }
          }, exports.timeout);
        }
      }

      return cb(null, JSON.stringify(info));
    });
  } else {
    return typeof (cb) === 'function' && cb(new Error('Action only allowed on Windows'));
  }
};
