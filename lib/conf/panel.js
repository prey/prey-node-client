// load API and panel plugin for configuration

var config = require('../common').config,
    ennio  = require('./../common').plugins,
    plugin = require('./../agent/plugin');

var api;

function setup_api() {
  if (api) return api;

  var opts   = config.get('control-panel'),
      panel  = ennio.require('control-panel');

  api = panel.load_api(opts);
  return api;
}

exports.verify_keys = function(keys, cb) {
  setup_api();
  api.keys.verify(keys, cb);
}

exports.authorize = function(opts, cb) {
  setup_api();
  api.accounts.authorize(opts, cb);
}

exports.signup = function(data, cb) {
  setup_api();
  api.accounts.signup(data, cb);
}

exports.register = function(cb) {
  plugin.enabled('control-panel', cb);
}
