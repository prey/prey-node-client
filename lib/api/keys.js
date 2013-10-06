var errors  = require('./errors'),
    request = require('./request');

var keys   = {};

var verify_keys = function(obj, cb) {
  var url = '/devices/' + obj.device + '/verify';
  var opts = { username: obj.api, password: 'x' };

  request.get(url, opts, function(err, resp, body) {
    if (err) return cb(err);

    if (resp.statusCode === 200)
      cb()
    else if (resp.statusCode === 406)
      cb(errors.get('INVALID_DEVICE_KEY'))
    else if (resp.statusCode === 401)
      cb(errors.get('INVALID_CREDENTIALS'))
    else
      cb(new Error(body.toString()))
  })
}

exports.present = function() {
  return !!(keys.api && keys.device);
}

exports.get = function() {
  return keys;
}

exports.set = function(obj) {
  if (!obj.api && !keys.api)
    throw(errors.get('NO_API_KEY'));

  if (obj.api)
    keys.api = obj.api;

  if (obj.device)
    keys.device = obj.device;

  return keys;
}

exports.verify = function(obj, cb) {
  if (!obj.api)
    return cb(errors.get('NO_API_KEY'));
  else if (!obj.device)
    return cb(errors.get('NO_DEVICE_KEY'))

  verify_keys(obj, function(err) {
    if (err) return cb(err);

    exports.set(obj);
    cb();
  })
}

exports.unset = function(key) {
  return delete keys[key];
}
