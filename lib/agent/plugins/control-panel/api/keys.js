var errors  = require('./errors'),
    request = require('./request');

var keys   = {};

var verify_keys = function(obj, cb) {
  var url = '/devices/' + obj.device + '/verify.json';
  var opts = { username: obj.api, password: 'x' };

  request.get(url, opts, function(err, resp, body) {
    if (err) return cb(err);

    if (resp.statusCode === 200)
      cb()
    else if (resp.statusCode === 406 || resp.statusCode === 404)
      cb(errors.get('INVALID_DEVICE_KEY'))
    else if (resp.statusCode === 401)
      cb(errors.get('INVALID_CREDENTIALS'))
    else
      cb(new Error('Unable to verify keys: ' + body.toString()))
  })
}

exports.present = function() {
  return !!(keys.api && keys.device);
}

exports.get = function() {
  return keys;
}

// only returns error if api key is empty
exports.set = function(obj, cb) {
  var shoot = function(err) {
    if (cb) return cb(err);
    else throw err;
  }

  if (!obj.api && !keys.api)
    return shoot(errors.get('NO_API_KEY'));

  if (obj.api)
    keys.api = obj.api;

  if (obj.device)
    keys.device = obj.device;

  cb && cb();
  return keys;
}

// returns error if api or device keys are empty
// or if the servers does not validates them
exports.verify = function(obj, cb) {

  var shoot = function(err) {
    if (cb) return cb(err);
    else throw err;
  }

  if (!obj.api)
    return shoot(errors.get('NO_API_KEY'));
  else if (!obj.device)
    return shoot(errors.get('NO_DEVICE_KEY'))

  verify_keys(obj, function(err) {
    if (err) return shoot(err);

    exports.set(obj);
    cb && cb();
  })
}

exports.unset = function(key) {
  return delete keys[key];
}
