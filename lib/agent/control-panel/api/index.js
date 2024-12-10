exports.logger    = require('./logger');
exports.keys      = require('./keys');
exports.accounts  = require('./accounts');
exports.devices   = require('./devices');
exports.push      = require('./push');

/**
 * Allows to pass a custom logger and/or request client to be used
 * across all control-panel api.
 *
 * @param {Object} obj
 * @param {Object} [obj.logger] - A custom logger to use.
 * @param {Object} [obj.request] - A custom request client to use.
 */
exports.use = (obj) => { 
  if (obj.logger) exports.logger.use(obj.logger);
  require('./request').use(obj);
}
