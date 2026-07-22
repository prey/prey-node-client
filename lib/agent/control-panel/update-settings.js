// @ts-check
const config = require('../../utils/configfile');
const common = require('../common');

const logger = common.logger.prefix('update-settings');

/**
 * @param {Object} values
 * @param {string} [prefix='']
 */
const processSettings = (values, prefix = '') => {
  Object.keys(values).forEach((key) => {
    const value = values[key];
    const fullKey = prefix ? `${prefix}.${key}` : key;

    if (key === 'permissions' && value === null) return;

    // Store tracking_schedule as a whole object — do not recurse into its keys
    if (key === 'tracking_schedule') {
      if (value !== null && typeof value === 'object') {
        logger.notice(`Updating value of ${fullKey}`);
        config.setData(fullKey, value);
      }
      return;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      processSettings(value, fullKey);
    } else {
      const finalValue = value == null ? false : value;
      if (typeof finalValue !== 'undefined' && config.getData(fullKey) !== finalValue) {
        logger.notice(`Updating value of ${fullKey} to ${finalValue}`);
        config.setData(fullKey, finalValue);
      }
    }
  });
};

/**
 * @param {{ global?: Object, local?: Object }} obj
 */
exports.processSettingsUpdate = (obj) => {
  if (obj.global) processSettings(obj.global);
  if (obj.local) processSettings(obj.local, 'control-panel');
};
