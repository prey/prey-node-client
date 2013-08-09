var keys    = require('./keys'),
    request = require('./request');

exports.commands = function(cb) {
  request.get('/devices/' + keys.get().device + '.json', cb)
}
