/* eslint-disable consistent-return */
const os = require('os');
const common = require('../../common');
const commands = require('../../commands');

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
      if (!Array.isArray(info)) return cb(new Error('Invalid encryption keys information'));

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
          setTimeout(() => {
            exports.scheduled = false;
            commands.perform({ command: 'get', target: 'encryption_keys' });
          }, exports.timeout);
        }
      } else {
        processing = false;
      }

      return cb(null, JSON.stringify(info));
    });
  } else {
    return typeof (cb) === 'function' && cb(new Error('Action only allowed on Windows'));
  }
};
