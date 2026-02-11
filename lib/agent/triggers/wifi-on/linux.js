/**
 * WiFi On - Linux Implementation
 * Provides functions to check and enable WiFi on Linux systems
 */

const exec = require('child_process').exec;
const common = require('../../common');
const sudo = require('sudoer');

const logger = common.logger.prefix('wifi-on');

/**
 * Check if WiFi is enabled
 * @param {Function} cb - Callback(err, isEnabled) - isEnabled is true if WiFi is on, false if off
 */
exports.check_wifi = function(cb) {
  logger.debug('Checking WiFi state...');
  const cmd = 'nmcli radio wifi';

  exec(cmd, function(err, stdout) {
    if (err) {
      logger.error(`Error checking WiFi state: ${err.message}`);
      return cb(err, false);
    }

    const output = stdout.trim();

    if (output === 'enabled') {
      logger.debug('WiFi state: enabled');
      return cb(null, true);
    } else {
      logger.debug('WiFi state: disabled');
      return cb(null, false);
    }
  });
};

/**
 * Enable WiFi
 * @param {Function} cb - Callback(err)
 */
exports.enable_wifi = function(cb) {
  logger.info('Attempting to turn on WiFi...');

  sudo('nmcli', ['radio', 'wifi', 'on'], function(err, stdout, stderr) {
    if (err) {
      logger.error(`Error enabling WiFi: ${err.message}`);
      return cb(err);
    }

    logger.info('WiFi turned on successfully');
    return cb(null);
  });
};
