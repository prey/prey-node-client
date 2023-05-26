var logger = require('./common').logger.prefix('hooks');
var Emitter = require('events').EventEmitter;
var emitter = new Emitter();

var trigger = function (event) {
  logger.info('Hook triggered: ' + event, arguments[1]);
  emitter.emit.apply(this, arguments);
};

var remove = function (event, fn) {
  if (fn) emitter.removeListener(event, fn);
  else if (event) emitter.removeAllListeners(event);
};

var unload = function () {
  logger.info('Unregistering hooks.');
  emitter.removeAllListeners();
};

emitter.on('error', function (err) {
  logger.error('error on emitter' + ((err) ? JSON.stringify(err) : ''));
  // prevents 'Unspecified Error event'
});

module.exports = emitter;
module.exports.trigger = trigger;
module.exports.remove = remove;
module.exports.unload = unload;
