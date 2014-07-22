var needle = require('needle');

function request(method, url, data, opts, cb) {
  needle.request(method, url, data, opts, function(err, resp) {
    if (err) return hooks.trigger('error', err);

    hooks.trigger('response', err, resp, data);
    cb && cb(err, resp);
  })
}

exports.defaults = function(opts) {
  return needle.defaults(opts);
}

exports.get = function(url, opts, cb) {
  return request('GET', url, null, opts, cb)
}

exports.post = function(url, data, opts, cb) {
  return request('POST', url, data, opts, cb)
}

exports.put = function(url, data, opts, cb) {
  return request('PUT', url, data, opts, cb)
}

exports.del = function(url, data, opts, cb) {
  return request('DELETE', url, data, opts, cb)
}
