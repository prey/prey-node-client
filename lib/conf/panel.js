// load API and panel plugin for configuration
// set an ENV variable so the plugin knows where to stop

var plugin = require('./../agent/plugin'),
    http   = require('./../agent/transports').http,
    api    = plugin.require('control-panel').api;

exports.authorize = function(opts, cb) {
  api.accounts.authorize(opts, cb);
}

exports.verify_keys = function(keys, cb) {
  api.keys.verify(keys, cb);
}

exports.signup = function(data, cb) {
  api.accounts.signup(data, cb);
}

exports.unlink_device = function(cb) {
  api.devices.unlink(cb);
}

exports.register = function(cb) {
  plugin.added('control-panel', cb);
}
