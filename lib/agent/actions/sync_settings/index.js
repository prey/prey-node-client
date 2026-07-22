// @ts-check
const { EventEmitter } = require('events');
const common = require('../../common');
const api = require('../../control-panel/api');
const { processSettingsUpdate } = require('../../control-panel/update-settings');

const logger = common.logger.prefix('sync_settings');
const config = require('../../../utils/configfile');
const errorsActions = require('../../../constants/actions');

/** @type {EventEmitter|undefined} */
let emitter;

/**
 * @param {string} id
 * @param {Error|null} [err]
 */
const done = (id, err) => {
  if (!emitter) emitter = new EventEmitter();
  emitter.emit('end', id, err);
};

/** @param {Object} obj */
const updateSettings = (obj) => processSettingsUpdate(obj);

/**
 * @param {string} id
 * @param {Object} _opts
 * @param {Function} cb
 */
// eslint-disable-next-line consistent-return
exports.start = (id, _opts, cb) => {
  cb();
  api.devices.get.status((/** @type {Error|null} */ err, /** @type {any} */ response) => {
    if (err) return;
    const result = response && response.body;
    // eslint-disable-next-line consistent-return, max-len
    if (!result || (response && response.statusCode > 300)) return done(id, new Error(errorsActions.INVALID_RESPONSE));
    if (result.settings) {
      updateSettings(result.settings);
    }

    if (result.location && Array.isArray(result.location.disabled_methods)) {
      config.setData('control-panel.location.disabled_methods', result.location.disabled_methods);
    } else if (result.location) {
      config.setData('control-panel.location.disabled_methods', []);
    }

    if (result.settings || result.location) {
      // eslint-disable-next-line consistent-return
      return done(id);
    }
    done(id, new Error(errorsActions.RESPONSE_NOT_FOUND));
  });
};

exports.stop = () => {
};
