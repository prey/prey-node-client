// load API and panel plugin for configuration

var common    = require('./../../common'),
    config    = common.config,
    plugins   = common.plugins,
    installed = require('./../../agent/plugin');

var api;

function setup_api() {
  if (api) return api;

  var opts   = config.get('control-panel'),
      panel  = plugins.require('control-panel');

  if (!opts)
    return;

  api = panel.load_api(opts);
  return api;
}

exports.verify_keys = function(keys, cb) {
  if (!setup_api())
    return cb(new Error('Invalid or outdated configuration file.'));

  api.keys.verify(keys, cb);
}

exports.authorize = function(opts, cb) {
  if (!setup_api())
    return cb(new Error('Invalid or outdated configuration file.'));

  api.accounts.authorize(opts, cb);
}

exports.signup = function(data, cb) {
  if (!setup_api())
    return cb(new Error('Invalid or outdated configuration file.'));

  api.accounts.signup(data, cb);
}

exports.link = function(cb) {
  installed.enabled('control-panel', cb);
}
