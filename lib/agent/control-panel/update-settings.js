// @ts-check
const config = require('../../utils/configfile');
const common = require('../common');
const { isValidSchedule } = require('../../utils/schedule');

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

    // Store tracking_schedule as a whole object — do not recurse into its keys.
    // Null, undefined, or empty objects from the backend explicitly clear the schedule.
    if (key === 'tracking_schedule') {
      if (isValidSchedule(value)) {
        logger.notice(`Updating value of ${fullKey}`);
        config.setData(fullKey, value);
      } else {
        logger.notice(`Clearing value of ${fullKey}: received null or empty schedule`);
        config.setData(fullKey, null);
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
