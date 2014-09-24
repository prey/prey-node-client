var needle  = require('needle'),
    https   = require('https'),
    keys    = require('./keys'),
    logger  = require('./logger'),
    version = '2';

var defaults = {
  client     : needle,
  protocol   : 'https',
  host       : 'solid.preyproject.com',
  user_agent : 'Prey Client API v' + version,
  timeout    : 90 * 1000
}

https.globalAgent.options.secureProtocol = 'SSLv3_method';

var api_root = '/api/v2';
var max_attempts = 3;

var is_network_down = function(err) {
  var codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND'];
  return codes.indexOf(err.code) !== -1;
}

var is_temporary_error = function(err, resp) {
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

  var base  = defaults.protocol + '://' + defaults.host,
      url   = base + api_root + path,
      start = new Date();

  logger.debug('Sending ' + method + ' request #' + attempt + ' to ' + base);
  // console.log(opts);

  defaults.client.request(method, url, data, opts, function(err, resp, body) {
    var seconds = (new Date() - start) / 1000;
    logger.debug('Attempt #' + attempt + ' took ' + seconds + ' seconds.');

    if (err && is_network_down(err)) {

      err.message = 'Network seems to be down. Check your connection and try again.';
      return cb(err);

    } else if (is_temporary_error(err, resp)) {

      if (attempt < max_attempts) { // retry the request
        logger.debug('Temporary network error. Retrying...');
        return send(attempt + 1, method, path, data, options, cb);
      } else if (err) { // maxed out all attempts. tell user to retry in a sec.
        err.message = err.message + ' - Please try again in a minute.';
      }

    }

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
    if (defaults.hasOwnProperty(key)) {

      // logger.debug('Setting ' + key + ' to ' + obj[key]);

      if (key == 'protocol' && ['http', 'https'].indexOf(obj[key]) === -1) {
        logger.error('Invalid protocol: ' + obj[key]);
        continue;
      }

      if (!obj[key]) {
        logger.error('Empty API value for key: ' + key);
        continue;
      }

      defaults[key] = obj[key];
    }
  }
  return defaults;
}
