var Emitter = require('events').EventEmitter;

module.exports = function() {
  var child = new Emitter();
  child.stdout = new Emitter();
  child.stderr = new Emitter();
  return child;
}