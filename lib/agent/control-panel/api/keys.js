const errors = require('./errors');
const request = require('./request');

const keys = {};

/**
 * If cb is given, calls it with err as the first argument (if given). Otherwise,
 * throws err.
 * @param {Error} [err] - error to throw or pass to cb
 * @param {Function} [cb] - callback function
 * @throws {Error} if no cb is given and err is given
 */
exports.shoot = (err, cb) => {
  if (cb) return cb(err);
  throw err;
};

/**
 * Verifies API and Device keys against the Panel.
 *
 * @param {Object} obj - keys to verify
 * @param {string} obj.api - API key
 * @param {string} obj.device - Device key
 * @param {Function} cb - callback function
 * @throws {Error} if the verification fails
 */
exports.verifyKeys = (obj, cb) => {
  const url = `/devices/${obj.device}/verify.json`;
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
  if (!obj.api && !keys.api) return exports.shoot(errors.get('NO_API_KEY'), cb);

  if (obj.api) keys.api = obj.api;

  if (obj.device) keys.device = obj.device;

  cb && cb();
  return keys;
};

/**
 * Verifies the given API and Device keys against the Panel and if the
 * verification is successful, sets them as the current keys.
 *
 * @param {Object} obj - keys to verify and set
 * @param {string} obj.api - API key to set
 * @param {string} obj.device - Device key to set
 * @param {Function} [cb] - callback function
 * @throws {Error} if the verification fails
 */
exports.verify = (obj, cb) => {
  if (!obj.api) return exports.shoot(errors.get('NO_API_KEY'), cb);
  if (!obj.device) return exports.shoot(errors.get('NO_DEVICE_KEY'), cb);

  exports.verifyKeys(obj, (err) => {
    if (err) return exports.shoot(err, cb);

    exports.set(obj);
    cb && cb();
  });
};

exports.unset = (key) => delete keys[key];
