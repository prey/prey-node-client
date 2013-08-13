"use strict";

var keys    = require('./keys'),
    errors  = require('./errors'),
    request = require('./request');

var set = function(key) {
  if (key) throw(new Error('No key!'));
  return keys.set({ device: key });
}

exports.link = function(data, cb) {
  if (keys.get().device)
    return cb(errors.get('DEVICE_KEY_SET'));
  else if (!keys.get().api)
    return cb(errors.get('NO_API_KEY'));

  request.post('/devices.json', data, {}, function(err, resp, body){
    if (err) return cb(err);

    if (body && body.key) {
      cb(null, set(body.key))

    } else if (resp.statusCode == 401) {
      cb(errors.get('INVALID_CREDENTIALS'))

    } else if (resp.statusCode === 302 || resp.statusCode == 403) {
      cb(errors.get('NO_AVAILABLE_SLOTS'));

    } else if (body.errors && body.errors.error) {
      cb(errors.validation(body.errors.error));

    } else {
      cb(errors.unknown(body.toString()))
    }

  });
};

exports.unlink = function(cb){
   if (!keys.get().api || !keys.get().device)
    return cb(errors.get('MISSING_KEY'));

  request.delete('/devices/' + keys.get().device, {}, function(err, resp, body) {
    if (err) return cb(err);

    if (resp.statusCode === 401)
      return cb(errors.get('INVALID_CREDENTIALS'))
    else if (resp.statusCode != 200)
      return cb(errors.unknown(body.toString()))

    keys.unset('device');
    cb();
  });
}
