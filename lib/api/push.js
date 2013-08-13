var keys    = require('./keys'),
    request = require('./request');

var format  = '.json';

var post = function(url, data, opts, cb) {
  var opts = opts || {};

  if (opts.status) {
    opts.headers = { 'X-Prey-Status': status };
    delete opts['status'];
  }

  request.post(url, data, opts, cb)
}

exports.response = function(data, opts, cb) {
  var url = '/devices/' + keys.get().device + '/response' + format;
  post(url, data, opts, cb);
}

exports.event = function(data, opts, cb) {
  var url = '/devices/' + keys.get().device + '/events' + format;
  post(url, data, opts, cb);
}

exports.data = function(data, opts, cb) {
  var url = '/devices/' + keys.get().device + '/data' + format;
  post(url, data, opts, cb);
}

exports.report = function(data, opts, cb) {
  var url = '/devices/' + keys.get().device + '/reports' + format;
  post(url, data, opts, cb);
}
