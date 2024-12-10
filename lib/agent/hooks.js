const logger = require('./common').logger.prefix('hooks');
const Emitter = require('events').EventEmitter;

const emitter = new Emitter();
const fetchEnvVar = require('../utils/fetch-env-var');

const trigger = function (event) {
  if (fetchEnvVar('DEBUG') && fetchEnvVar('DEBUG').localeCompare('true') === 0) logger.debug(`Hook triggered: ${JSON.stringify(arguments)}`);
  else if (event.localeCompare('device_unseen') !== 0) logger.info(`Hook triggered: ${event}`, arguments[1]);
  emitter.emit.apply(this, arguments);
};

const remove = function (event, fn) {
  if (fn) emitter.removeListener(event, fn);
  else if (event) emitter.removeAllListeners(event);
};

const unload = function () {
  logger.info('Unregistering hooks.');
  emitter.removeAllListeners();
};

emitter.on('error', (err) => {
  logger.error(`error on emitter${(err) ? JSON.stringify(err) : ''}`);
  // prevents 'Unspecified Error event'
});

module.exports = emitter;
module.exports.trigger = trigger;
module.exports.remove = remove;
module.exports.unload = unload;
