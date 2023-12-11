const common = require('../../common');
const panel = require('../../agent/control-panel');

const { config } = common;
let api;

const setup_api = () => {
  const opts = config.get('control-panel');

  if (api) { return api; }

  if (!opts) {
    console.log("Empty or outdated config file. Please run 'config activate' and retry.");
    return process.exit(1);
  }

  opts.try_proxy = config.get('try_proxy');

  api = panel.load_api(opts);
  return api;
};

exports.verify_keys = (keys, cb) => {
  setup_api();
  api.keys.verify(keys, cb);
};

exports.authorize = (opts, cb) => {
  setup_api();
  api.accounts.authorize(opts, cb);
};

exports.signup = (data, cb) => {
  setup_api();
  api.accounts.signup(data, cb);
};

exports.link = (cb) => {
  panel.enabled(cb);
};
