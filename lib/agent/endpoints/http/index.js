var needle = require('needle');

exports.send = function(data, opts, cb) {
  needle.post(data, opts, cb);
}