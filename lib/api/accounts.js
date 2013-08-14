"use strict";

var inspect     = require('util').inspect,
    request      = require('./request'),
    errors       = require('./errors'),
    keys         = require('./keys');

var set = function(key) {
  return keys.set({ api: key });
}

var validate = function(data) {
  if (!data.username)
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

  request.get('/profile.json', opts, function(err, resp, body){
    if (err) return cb(err);

    if (resp.statusCode == 401) {
      cb(errors.get('INVALID_CREDENTIALS'))

    } else if (body.user && parseInt(body.user.available_slots) <= 0) {
      cb(errors.get('NO_AVAILABLE_SLOTS'));

    } else if (body.user && body.user.key) {
      cb(null, set(body.user.key));

    } else {
      cb(errors.unknown(resp.body.toString()));
    }
 });

}

exports.signup = function(data, cb){
  if (!data) throw(errors.arguments('Empty data.'));

  if (keys.get().api)
    throw(errors.get('API_KEY_SET'))

  var errs = validate(data);
  if (errs)
    return cb(errors.validation(errs));

  request.post('/signup.json', data, {}, function(err, resp, body){
    if (err) return cb(err);

    if (body && body.user && body.user.key) {
      cb(null, set(body.user.key));
    } else {
      cb(errors.unknown(inspect(body)));
    }
  });
}
