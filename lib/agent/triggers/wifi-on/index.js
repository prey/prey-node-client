/**
 * WiFi On Trigger
 * Automatically turns on WiFi if it gets disabled (Linux only)
 *
 * This trigger:
 * 1. Checks WiFi state on startup and enables it if disabled
 * 2. Listens for 'wifi_state_changed' events and ensures WiFi stays on
 */

const { join } = require('path');
const { EventEmitter } = require('events');

const base_path = join(__dirname, '..', '..');
const hooks = require(join(base_path, 'hooks'));
const common = require('../../common');

const os_name = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
const logger = common.logger.prefix('wifi-on');
const config = require('../../../utils/configfile');

let os_functions;
let emitter;
let retryCount = 0;
const MAX_RETRIES = 3;

/**
 * Reset retry counter (called when WiFi is successfully enabled)
 */
const resetRetryCount = function() {
  if (retryCount > 0) {
    logger.debug(`Resetting retry counter (was at ${retryCount})`);
    retryCount = 0;
  }
};

/**
 * Check and enable WiFi if disabled
 */
const ensureWifiEnabled = function() {
  os_functions.check_wifi(function(err, isEnabled) {
    if (err) {
      logger.error(`Error checking WiFi state: ${err.message}`);
      return;
    }

    if (isEnabled === true) {
      logger.debug('WiFi is already enabled, nothing to do');
      // Reset retry counter when WiFi is on
      resetRetryCount();
      return;
    }

    // WiFi is disabled, check retry count
    if (retryCount >= MAX_RETRIES) {
      logger.warn(`WiFi is disabled but maximum retry attempts (${MAX_RETRIES}) reached, stopping attempts`);
      return;
    }

    retryCount++;
    logger.warn(`WiFi is disabled, attempting to enable (attempt ${retryCount}/${MAX_RETRIES})...`);

    os_functions.enable_wifi(function(err) {
      if (err) {
        logger.error(`Failed to enable WiFi (attempt ${retryCount}/${MAX_RETRIES}): ${err.message}`);
        // Retry if we haven't reached max attempts
        if (retryCount < MAX_RETRIES) {
          logger.debug('Retrying to enable WiFi...');
          ensureWifiEnabled();
        }
        return;
      }

      // Verify WiFi was enabled successfully
      os_functions.check_wifi(function(err, isEnabledAfter) {
        if (err) {
          logger.error(`Error verifying WiFi state: ${err.message}`);
          return;
        }

        if (isEnabledAfter === true) {
          logger.info(`WiFi successfully enabled on attempt ${retryCount}/${MAX_RETRIES}`);
          resetRetryCount();
        } else {
          logger.warn(`WiFi enable command completed but WiFi still appears disabled (attempt ${retryCount}/${MAX_RETRIES})`);
          // WiFi still disabled after enable command, retry if possible
          if (retryCount < MAX_RETRIES) {
            logger.debug('WiFi still disabled, retrying...');
            ensureWifiEnabled();
          } else {
            logger.error(`Maximum retry attempts (${MAX_RETRIES}) reached, WiFi could not be enabled`);
          }
        }
      });
    });
  });
};

/**
 * Start the WiFi-on trigger
 */
exports.start = function(opts, cb) {
  try {
    os_functions = require('./' + os_name);
  } catch (err) {
    logger.error(`Failed to load OS functions: ${err.message}`);
    return cb(err);
  }

  logger.debug('Starting WiFi-on trigger');

  // Check and enable WiFi on startup
  ensureWifiEnabled();

  // Listen for WiFi state changes
  hooks.on('wifi_state_changed', () => {
    logger.debug('WiFi state change detected, checking...');
    resetRetryCount();
    if (config.getData('control-panel.force_wifi_on')) {
      ensureWifiEnabled();
    }
  });

  emitter = new EventEmitter();
  cb(null, emitter);
};

/**
 * Stop the WiFi-on trigger
 */
exports.stop = function() {
  hooks.remove('wifi_state_changed');

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [];
