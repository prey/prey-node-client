"use strict";

var request      = require('./request'),
    errors       = require('./errors'),
    keys         = require('./keys');

var set = function(key) {
  keys.set({ api: key });
  return key;
}

var validate = function(data) {
  if (!data.name || data.name.trim() == '')
    return 'No username.';
  else if (!data.email || !data.email.match(/\@/)) // TODO: fix this
    return 'Invalid email.';
  else if (!data.password || data.password.length < 6)
    return 'Password too short.';
}

exports.authorize = function(opts, cb) {
  if (!opts || !opts.username || !opts.password)
    throw(errors.arguments('No credentials passed!'));

  if (keys.get().api)
    throw(errors.get('API_KEY_SET'))

  request.get('/profile.json', opts, function(err, resp) {
    if (err) return cb(err);

    var body = resp.body;

    if (resp.statusCode == 401) {
      cb(errors.get('INVALID_CREDENTIALS'))

    } else if (body.user && parseInt(body.user.available_slots) <= 0) {
      cb(errors.get('NO_AVAILABLE_SLOTS'));

    } else if (body && body.key || (body.user && body.user.key)) {
      cb(null, set(body.key || body.user.key));

    } else {
      cb(errors.unknown(resp));
    }
 });

}

exports.signup = function(data, cb){
  if (!data || Object.keys(data).length == 0)
    throw(errors.arguments('Empty data.'));

  if (keys.get().api)
    throw(errors.get('API_KEY_SET'))

  var errs = validate(data);
  if (errs)
    return cb(errors.validation(errs));

  request.post('/signup.json', data, {}, function(err, resp) {
    if (err) return cb(err);

    var body = resp.body;

    if (body.key || (body.user && body.user.key)) {
      cb(null, set(body.key || body.user.key));
    } else if (resp.statusCode == 422) {
      cb(errors.unprocessable(body));
    } else {
      cb(errors.unknown(resp));
    }
  });
}
