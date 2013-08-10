var keys    = require('./keys'),
    request = require('./request');

exports.response = function(data, cb) {
  var url = '/devices/' + keys.get().device + '/response.json';
  request.post(url, data, opts, cb);
}

exports.event = function(data, opts, cb) {
  var url = '/devices/' + keys.get().device + '/events.json';
  request.post(url, data, opts, cb);
}

exports.data = function(data, opts, cb) {
  var url = '/devices/' + keys.get().device + '/data.json';
  request.post(url, data, opts, cb);
}

exports.report = function(data, opts, cb) {
  var url = '/devices/' + keys.get().device + '/reports.json';
  request.send('POST', url, data, opts, cb);
}
