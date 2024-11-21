const panel = require('../../agent/control-panel');

const config = require('../../utils/configfile');

let api;

const setup_api = (cb) => {
  const opts = config.all();
  if (api) { return cb(api); }

  if (!opts) {
    console.log("Empty or outdated config file. Please run 'config activate' and retry.");
    return process.exit(1);
  }

  opts.try_proxy = config.getData('try_proxy');

  api = panel.load_api(opts);
  cb(api);
};

exports.verify_keys = (keys, cb) => {
  setup_api(() => {
    api.keys.verify(keys, cb);
  });
};

exports.authorize = (opts, cb) => {
  setup_api(() => {
    api.accounts.authorize(opts, cb);
  });
};

exports.signup = (data, cb) => {
  setup_api(() => {
    api.accounts.signup(data, cb);
  });
};

exports.link = (cb) => {
  panel.enabled(cb, 'cli');
};
