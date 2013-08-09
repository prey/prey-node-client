var errors  = require('./errors'),
    request = require('./request');

var keys   = {};

var verify_keys = function(obj, cb) {
  if (!obj.api || !obj.device)
    return cb(errors.get('MISSING_KEY'));

  var url = '/devices/' + keys.device + '/verify';
  var opts = { username: obj.api, password: 'x' };

  request.get(url, opts, function(err, resp, body){
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

exports.get = function() {
  return keys;
}

exports.set = function(obj) {
  if (!obj.api)
    throw(errors.get('NO_API_KEY'));

  keys.api = obj.api;
  if (obj.device)
    keys.device = obj.device;
}

exports.verify = function(obj, cb) {
  verify_keys(obj, function(err) {
    if (err) return cb(err);

    set(obj);
    cb();
  })
}
