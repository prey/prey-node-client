const request = require('./request');
const errors = require('./errors');
const keys = require('./keys');
const common = require('../../../common');

const lang = common.system.lang || 'en';

const set = function (key) {
  console.log(`setting ${key}`);
  keys.set({ api: key });
  return key;
};

const validate = function (data) {
  if (!data.policy_rule_privacy_terms) return 'You need to accept the Terms & Conditions and Privacy Policy to continue';
  if (!data.policy_rule_age) return 'You must be older than 16 years old to use Prey';
};

exports.authorize = function (opts, cb) {
  if (!opts || !opts.username || !opts.password) { throw (errors.arguments('No credentials passed!')); }

  if (keys.get().api) { throw (errors.get('API_KEY_SET')); }

  request.get(`/profile.json?lang=${lang}`, opts, (err, resp) => {
    if (err) return cb(err);

    const { body } = resp;

    if (resp.statusCode == 401) {
      if (body) return cb(errors.unprocessable(body));
      cb(errors.get('INVALID_CREDENTIALS'));
    } else if (body && parseInt(body.available_slots) <= 0) {
      cb(errors.get('NO_AVAILABLE_SLOTS'));
    } else if (body && body.key || (body && body.user && body.user.key)) {
      cb(null, set(body.key || body.user.key));
    } else {
      cb(errors.unknown(resp));
    }
  });
};

exports.signup = function (data, cb) {
  if (!data || Object.keys(data).length == 0) { throw (errors.arguments('Empty data.')); }

  if (keys.get().api) { throw (errors.get('API_KEY_SET')); }

  const errs = validate(data);
  if (errs) { return cb(errors.validation(errs)); }

  request.post(`/signup.json?lang=${lang}`, data, {}, (err, resp) => {
    if (err) return cb(err);

    const { body } = resp;

    if (body.key || (body.user && body.user.key)) {
      cb(null, set(body.key || body.user.key));
    } else if (resp.statusCode == 422) {
      cb(errors.unprocessable(body));
    } else {
      cb(errors.unknown(resp));
    }
  });
};
