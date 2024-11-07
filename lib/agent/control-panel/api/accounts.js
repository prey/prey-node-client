const request = require('./request');
const errors = require('./errors');
const keys = require('./keys');
const common = require('../../../common');

const lang = common.system.lang || 'en';

/**
 * Sets an API key for the user.
 *
 * @param {string} key - the API key to set.
 *
 * @throws {Error} if an API key is already set.
 *
 * @returns {string} the API key set.
 */
exports.set = (key) => {
  keys.set({ api: key });
  return key;
};

/**
 * Validates user input when creating a new account.
 *
 * @param {Object} data - User input to validate.
 *
 * @returns {string} An error message if the input is invalid, or nothing if it's valid.
 */
exports.validate = function (data) {
  if (!data.policy_rule_privacy_terms) {
    return 'You need to accept the Terms & Conditions and Privacy Policy to continue';
  }

  if (!data.policy_rule_age) {
    return 'You must be older than 16 years old to use Prey';
  }
};

/**
 * Authorizes user with the given credentials.
 *
 * @param {Object} opts - Credentials to check.
 * @param {string} opts.username - Username.
 * @param {string} opts.password - Password.
 * @param {Function} cb - Callback function.
 *
 * @throws {Error} if an API key is already set.
 *
 * @returns {string} the API key set.
 */
exports.authorize = function (opts, cb) {
  if (!opts || !opts.username || !opts.password) { throw (errors.arguments('No credentials passed!')); }

  if (keys.get().api) { throw (errors.get('API_KEY_SET')); }

  // eslint-disable-next-line consistent-return
  request.get(`/profile.json?lang=${lang}`, opts, (err, resp) => {
    if (err) return cb(err);

    const { body } = resp;

    if (resp.statusCode === 401) {
      if (body) return cb(errors.unprocessable(body));
      cb(errors.get('INVALID_CREDENTIALS'));
    } else if ((body && body.key) || (body && body.user && body.user.key)) {
      cb(null, exports.set(body.key || body.user.key));
    } else {
      cb(errors.unknown(resp));
    }
  });
};

/**
 * Signs up a new user with the provided data.
 *
 * @param {Object} data - User input for signup.
 * @param {Function} cb - Callback function.
 *
 * @throws {Error} if the data is empty or an API key is already set.
 * 
 * @returns {void} - Invokes callback with an error or the set API key.
 */
exports.signup = (data, cb) => {
  if (!data || Object.keys(data).length === 0) {
    throw (errors.arguments('Empty data.'));
  }

  if (keys.get().api) {
    throw (errors.get('API_KEY_SET'));
  }

  const errs = exports.validate(data);
  if (errs) {
    return cb(errors.validation(errs));
  }

  request.post(`/signup.json?lang=${lang}`, data, {}, (err, resp) => {
    if (err) return cb(err);

    const { body } = resp;

    if (body.key || (body.user && body.user.key)) {
      cb(null, set(body.key || body.user.key));
    } else if (resp.statusCode === 422) {
      cb(errors.unprocessable(body));
    } else {
      cb(errors.unknown(resp));
    }
  });
};
