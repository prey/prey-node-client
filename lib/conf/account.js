/* eslint-disable no-restricted-syntax */
/* eslint-disable consistent-return */
const shared = require('./shared');

const log = (str) => shared.log(str);

const verifyData = (hash) => {
  const obj = {};

  for (const key in hash) {
    if (typeof hash[key] !== 'undefined') obj[key] = hash[key];
  }

  return obj;
};

// set api key and call setup so device gets linked
// called from cli.js after signing up or signing in
exports.setApiKeyAndRegister = (key, cb) => {
  // set API key and clear Device key
  shared.keys.set_api_key(key, (err) => {
    if (err) return cb(err);
    log('Linking device...');
    shared.panel.link((errLink) => {
      if (!errLink) return cb();

      // ok, we got an error. clear the API key before returning.
      // call back the original error as well.
      shared.keys.set_api_key('', () => {
        cb(errLink);
      });
    });
  });
};

exports.setApiKeyAndDeviceKeyRegister = (keys, cb) => {
  // ensure the plugin is loaded if registration succeeds
  const apiDevPair = { api: keys.api_key, device: keys.device_key };
  // eslint-disable-next-line consistent-return
  shared.keys.set_api_device_key(apiDevPair, (errApiDevice) => {
    if (errApiDevice) return cb(errApiDevice);
    // eslint-disable-next-line consistent-return
    shared.panel.verify_keys(apiDevPair, (errVerify) => {
      if (errVerify) {
        return shared.keys.set_api_device_key({ api: '', device: '' }, (e) => {
          cb(errVerify);
        });
      }
      cb();
    });
  });
};

// eslint-disable-next-line consistent-return
exports.authorize = (values, cb) => {
  const opts = {};
  const args = {
    api_key: values['-a'],
    device_key: values['-d'],
    email: values['-e'],
    password: values['-p'],
  };

  if (args.email && !args.password) return cb(new Error('Password required.'));

  opts.username = args.email || args.api_key;
  opts.password = args.password || 'x';

  // eslint-disable-next-line consistent-return
  shared.panel.authorize(opts, (err, key) => {
    if (err || !key) return cb(err || new Error("Couldn't verify credentials."));
    if (args.device_key && args.device_key !== '') {
      return exports.setApiKeyAndDeviceKeyRegister({
        api_key: args.api_key,
        device_key: args.device_key,
      }, cb);
    }
    exports.setApiKeyAndRegister(key, cb);
  });
};

exports.verify = (values, cb) => {
  let obj = {};
  const current = values['-c'] === true;
  const update = values['-u'] === true;

  if (current) {
    obj = shared.keys.get();
  } else {
    obj.api = values['-a'];
    obj.device = values['-d'];
  }

  shared.panel.verify_keys(obj, (err) => {
    if (!err) log('Keys are A-OK.');

    // if error or just checking current (no need to update)
    // or no update requested, then just return
    if (err || current || !update) return cb(err);

    shared.keys.set(obj, cb);
  });
};

exports.signup = (values, cb) => {
  if (shared.keys.is_api_key_set()) return cb(new Error('Account already set up!'));

  const acceptOpts = ['yes', 'y', 'true'];
  const termsCheck = values['-t'] ? (acceptOpts.indexOf(values['-t'].toLowerCase()) !== -1) : false;
  const ageCheck = values['-a'] ? (acceptOpts.indexOf(values['-a'].toLowerCase()) !== -1) : false;

  const data = verifyData({
    name: values['-n'],
    email: values['-e'],
    password: values['-p'],
    password_confirmation: values['-p'],
    policy_rule_privacy_terms: termsCheck,
    policy_rule_age: ageCheck,
    country: values['-c'],
  });

  shared.panel.signup(data, (err, key) => {
    if (err || !key) return cb(err || new Error('No API Key received.'));

    log('Account created!');
    exports.setApiKeyAndRegister(key, cb);
  });
};

exports.setup = (values, cb) => {
  const runAgain = values['-f'] === true;

  if (shared.keys.is_api_key_set() && !runAgain) return cb(new Error('Account already set up! Run with -f/--force to continue anyway.'));

  shared.panel.setup('control-panel', (err) => {
    if (err) return cb(err);

    log('Credentials verified.');
    shared.keys.set_device_key('', (errSetKey) => {
      if (errSetKey) return cb(errSetKey);

      log('Linking device...');
      shared.panel.link(cb);
    });
  });
};
