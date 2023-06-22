///
// load API and panel plugin for configuration
///

const common = require('../../common');
const controlPanel = require('../../agent/control-panel');

const { config } = common;
let api;

function setupApi() {
  const opts = config.get('control-panel');

  if (api) {
    return api;
  }

  if (!opts) {
    console.log(
      "Empty or outdated config file. Please run 'config activate' and retry."
    );
    return process.exit(1);
  }

  opts.try_proxy = config.get('try_proxy');

  api = controlPanel.load_api(opts);
  return api;
}

exports.verify_keys = (keys, cb) => {
  setupApi();
  api.keys.verify(keys, cb);
};

exports.authorize = (opts, cb) => {
  setupApi();
  api.accounts.authorize(opts, cb);
};

exports.signup = (data, cb) => {
  setupApi();
  api.accounts.signup(data, cb);
};

exports.link = (cb) => {
  controlPanel.enabled(cb)
};
