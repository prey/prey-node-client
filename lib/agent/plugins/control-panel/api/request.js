var keys    = require('./keys'),
    logger  = require('./logger'),
    version = '2';

var defaults = {
  client     : null,
  protocol   : 'https',
  host       : 'solid.preyproject.com',
  user_agent : 'Prey Client API v' + version,
  timeout    : 90 * 1000
}

var api_root = '/api/v2';
var max_attempts = 3;

var should_retry = function(err, resp) {
  var retry = false;

  if (err)
    retry = (err.code == 'ETIMEDOUT' || err.code == 'ECONNRESET' || err.message.match('socket hang up'));
  else
    retry = (resp.statusCode == 502 || resp.statusCode == 503);

  return retry;
}

var send = function(attempt, method, path, data, options, cb) {
  if (!defaults.client)
    return cb(new Error('No HTTP client set!'))

  var opts = options || {};
  opts.timeout    = opts.timeout    || defaults.timeout;
  opts.user_agent = opts.user_agent || defaults.user_agent;

  if (!opts.username) {
    opts.username = keys.get().api;
    opts.password = 'x';
  }

  var base = defaults.protocol + '://' + defaults.host;
  var url  = base + api_root + path;

  logger.debug('Sending ' + method + ' request #' + attempt + ' to ' + base);
  // console.log(opts);

  defaults.client(method, url, data, opts, function(err, resp, body) {
    if (should_retry(err, resp) && attempt < max_attempts)
      return send(attempt + 1, method, path, data, options, cb);

    cb(err, resp, body);
  });
}

exports.get = function(path, opts, cb) {
  send(1, 'GET', path, null, opts, cb);
}

exports.post = function(path, data, opts, cb) {
  send(1, 'POST', path, data, opts, cb);
}

exports.delete = function(path, opts, cb) {
  send(1, 'DELETE', path, null, opts, cb);
}

exports.use = function(obj) {
  for (var key in obj) {
    if (defaults.hasOwnProperty(key))
      defaults[key] = obj[key];
  }
  return defaults;
}
