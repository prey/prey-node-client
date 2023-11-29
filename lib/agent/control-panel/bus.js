// this is a simple way of transmitting events
// between the different components of the control-panel plugin.

var Emitter = require('events').EventEmitter;

module.exports = new Emitter();