var keys    = require('./keys'),
    errors  = require('./errors'),
    request = require('./request');

exports.commands = function(cb) {
  if (!keys.get().device)
    throw errors.get('NO_DEVICE_KEY');

  request.get('/devices/' + keys.get().device + '.json', {}, cb)
}
