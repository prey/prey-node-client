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

  if (!opts) {
    console.log("Empty or outdated config file. Please run 'config activate' and retry.");
    return process.exit(1);
  }

  opts.try_proxy = config.get('try_proxy');

  api = panel.load_api(opts);
  return api;
}

exports.verify_keys = function(keys, cb) {
  setup_api();
  api.keys.verify(keys, cb);
};

exports.authorize = function(opts, cb) {
  setup_api();
  api.accounts.authorize(opts, cb);
};

exports.signup = function(data, cb) {
  setup_api();
  api.accounts.signup(data, cb);
};

exports.link = function(cb) {
  installed.enabled('control-panel', cb);
};
