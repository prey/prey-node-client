"use strict";

var inspect     = require('util').inspect,
    request      = require('./request'),
    errors       = require('./errors'),
    keys         = require('./keys');

var set = function(key) {
  this.keys.set({ api: key })
  return key;
}

var validate = function(data) {
  if (!data.username)
    return 'No username';
  else if (!data.email)
    return 'No email';
  else if (!data.password)
    return 'No password';
}

exports.authorize = function(opts, cb) {
  if (!opts.username || !opts.password)
    throw(new Error('No credentials passed!'));

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
  var errors = validate(data);
  if (errors)
    return (errors.validation(errors))

  request.post('/signup.json', data, {}, function(err, resp, body){
    if (err) return cb(err);

    if (body && body.user && body.user.key) {
      cb(null, set(body.user.key));
    } else {
      cb(errors.unknown(inspect(body)));
    }
  });
}
