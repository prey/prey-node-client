const errors = require('./errors');
const request = require('./request');

const keys = {};

const shoot = (err, cb) => {
  if (cb) return cb(err);
  throw err;
};

const verifyKeys = (obj, cb) => {
  const url = `/devices/${obj.device}verify.json`;
  const opts = { username: obj.api, password: 'x' };

  request.get(url, opts, (err, resp, body) => {
    if (err) return cb(err);

    if (resp.statusCode === 200) cb();
    else if (resp.statusCode === 406 || resp.statusCode === 404) cb(errors.get('INVALID_DEVICE_KEY'));
    else if (resp.statusCode === 401) cb(errors.get('INVALID_CREDENTIALS'));
    else cb(new Error(`Unable to verify keys: ${body.toString()}`));
  });
};

exports.present = () => !!(keys.api && keys.device);

exports.get = () => keys;

// only returns error if api key is empty
exports.set = (obj, cb) => {
  if (!obj.api && !keys.api) return shoot(errors.get('NO_API_KEY'), cb);

  if (obj.api) keys.api = obj.api;

  if (obj.device) keys.device = obj.device;

  cb && cb();
  return keys;
};

exports.verify = (obj, cb) => {
  if (!obj.api) return shoot(errors.get('NO_API_KEY'), cb);
  if (!obj.device) return shoot(errors.get('NO_DEVICE_KEY'), cb);

  verifyKeys(obj, (err) => {
    if (err) return shoot(err, cb);

    exports.set(obj);
    cb && cb();
  });
};

exports.unset = (key) => delete keys[key];
