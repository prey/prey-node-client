var logger = require('./common').logger.prefix('hooks'),
    Emitter = require('events').EventEmitter,
    hooks   = {},
    emitter = new Emitter();

var trigger = function(event, data, err){
  logger.notice('Hook triggered: ' + event);
  emitter.emit(event, data, err);
}

var remove  = function(event, fn) {
  if (fn)
    emitter.removeListener(event, fn);
  // else if (event)
  //  emitter.removeAllListeners(event);
}

var unload  = function() {
  logger.info('Unregistering hooks.')
  emitter.removeAllListeners();
}

emitter.on('error', function(err){
  // prevents 'Unspecified Error event'
})

module.exports         = emitter;
module.exports.trigger = trigger;
module.exports.remove  = remove;
module.exports.unload  = unload;
