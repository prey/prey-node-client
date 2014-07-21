exports.logger    = require('./logger');
exports.keys      = require('./keys');
exports.accounts  = require('./accounts');
exports.devices   = require('./devices');
exports.push      = require('./push');

exports.use       = function(obj) {
  if (obj.logger) exports.logger.use(obj.logger);
  require('./request').use(obj);
}
