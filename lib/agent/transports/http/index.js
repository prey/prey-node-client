var needle = require('needle'),
    hooks  = require('./../../hooks');

exports.request = function request(method, url, data, opts, cb) {
  needle.request(method, url, data, opts, function(err, resp) {
    if (err) hooks.trigger('error', err);

    // hooks.trigger('response', err, resp, data);
    cb && cb(err, resp);
  })
}

exports.defaults = function(opts) {
  return needle.defaults(opts);
}

exports.get = function(url, opts, cb) {
  return this.request('GET', url, null, opts, cb)
}

exports.post = function(url, data, opts, cb) {
  return this.request('POST', url, data, opts, cb)
}

exports.put = function(url, data, opts, cb) {
  return this.request('PUT', url, data, opts, cb)
}

exports.del = function(url, data, opts, cb) {
  return this.request('DELETE', url, data, opts, cb)
}
