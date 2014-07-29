// load API and panel plugin for configuration

var ennio  = require('./../common').plugins,
    plugin = require('./../agent/plugin'),
    panel  = ennio.require('control-panel'),
    api    = panel.api;

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
