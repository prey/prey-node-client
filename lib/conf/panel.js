// load API and panel plugin for configuration

var plugin = require('./../agent/plugin'),
    http   = require('./../agent/transports').http,
    api    = plugin.require('control-panel').api;

exports.verify_keys = function(keys, cb) {
  api.keys.verify(keys, cb);
}

exports.authorize = function(opts, cb) {
  api.accounts.authorize(opts, cb);
}

exports.signup = function(data, cb) {
  api.accounts.signup(data, cb);
}

exports.register = function(cb) {
  plugin.enabled('control-panel', cb);
}
