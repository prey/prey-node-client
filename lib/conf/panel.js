// load API and panel plugin for configuration
// set an ENV variable so the plugin knows where to stop

var plugin = require('./../agent/plugin'),
    http   = require('./../agent/transports').http,
    api    = plugin.require('control-panel').api;

var is_setup = false;

function setup() {
  if (is_setup) return;

  var obj = {
    client: http
  }

  api.use(obj)
  is_setup = true;
}

exports.authorize = function(opts, cb) {
  setup();
  api.accounts.authorize(opts, cb);
}

exports.verify_keys = function(keys, cb) {
  setup()
  api.keys.verify(keys, cb);
}

exports.signup = function(data, cb) {
  setup();
  api.accounts.signup(data, cb);
}

exports.unlink_device = function(cb) {
  setup();
  api.devices.unlink(cb);
}

exports.register = function(cb) {
  plugin.added('control-panel', cb);
}
