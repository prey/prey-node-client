var exceptions = require('./agent/exceptions');

module.exports = function(err, context) {
  var ex = (err instanceof Error) ? err : new Error(err);

  if (!process.env.DEBUG && !ex.notified) {
    exceptions.send(ex);
    ex.notified = true;
  }

  return ex;
};


if (process.env.DEBUG) {
  // var debug = require('./utils/debug');
  // debug.enable();
}
