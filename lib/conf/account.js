const shared = require('./shared');
const controlPanel = require('../agent/control-panel');

const log = (str) => {
  shared.log(str);
};

const verifyData = (hash) => {
  let obj = {};

  for (let key in hash) {
    if (typeof hash[key] !== 'undefined') {
      obj[key] = hash[key];
    }
  }

  return obj;
};

// set api key and call setup so device gets linked
// called from cli.js after signing up or signing in
const setApiKeyAndRegister = (key, cb) => {
  // ensure the plugin is loaded if registration succeeds
  const success = () => {
    cb();
  };

  // set API key and clear Device key
  shared.keys.set_api_key(key, (err) => {
    if (err) return cb(err);

    log('Linking device...');
    shared.panel.link((childErr) => {
      if (!childErr) {
        return success();
      }

      // ok, we got an error. clear the API key before returning.
      // call back the original error as well.
      shared.keys.set_api_key('', (childError) => {
        cb(childError);
      });
    });
  });
};

exports.authorize = (values, cb) => {
  let opts = {};
  const args = {
    api_key: values['-a'],
    email: values['-e'],
    password: values['-p'],
  };

  if (args.email && !args.password) return cb(new Error('Password required.'));

  opts.username = args.email || args.api_key;
  opts.password = args.password || 'x';

  shared.panel.authorize(opts, (err, key) => {
    if (err || !key)
      return cb(err || new Error("Couldn't verify credentials."));

    setApiKeyAndRegister(key, cb);
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
    if (!err) {
      log('Keys are OK.');
    }

    // if error or just checking current (no need to update)
    // or no update requested, then just return
    if (err || current || !update) {
      return cb(err);
    }

    shared.keys.set(obj, cb);
  });
};

exports.signup = (values, cb) => {
  if (shared.keys.isApiKeySet())
    return cb(new Error('Account already set up!'));

  const acceptOpts = ['yes', 'y', 'true'];
  const termsCheck = values['-t']
    ? acceptOpts.indexOf(values['-t'].toLowerCase()) == -1
      ? false
      : true
    : false;

  const ageCheck = values['-a']
    ? acceptOpts.indexOf(values['-a'].toLowerCase()) == -1
      ? false
      : true
    : false;

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
    setApiKeyAndRegister(key, cb);
  });
};

exports.setup = (values, cb) => {
  const runAgain = values['-f'] === true;

  if (shared.keys.isApiKeySet() && !runAgain)
    return cb(
      new Error(
        'Account already set up! Run with -f/--force to continue anyway.'
      )
    );

  controlPanel.setup((err) => {
    if (err) {
      return cb(err);
    }

    log('Credentials verified.');
    shared.keys.setDeviceKey('', (childErr) => {
      if (childErr) {
        return cb(childErr);
      }

      log('Linking device...');
      shared.panel.link(cb);
    });
  });
};
