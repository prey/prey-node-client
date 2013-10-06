var needle  = require('needle'),
    keys    = require('./keys'),
    logger  = require('./logger'),
    version = '2';

var defaults = {
  protocol   : 'https',
  host       : 'solid.preyproject.com',
  user_agent : 'Prey Client API v' + version,
  timeout    : 90 * 1000
}

var api_root = '/api/v2';

var send = function(method, path, data, opts, cb) {

  var opts = opts || {};
  opts.timeout    = opts.timeout    || defaults.timeout;
  opts.user_agent = opts.user_agent || defaults.user_agent;

  if (!opts.username) {
    opts.username = keys.get().api;
    opts.password = 'x';
  }

  var base = defaults.protocol + '://' + defaults.host;
  var url  = base + api_root + path;

  logger.info('Sending request to ' + base);
  // console.log(opts);

  needle.request(method, url, data, opts, cb);
}

exports.get = function(path, opts, cb) {
  send('GET', path, null, opts, cb);
}

exports.post = function(path, data, opts, cb) {
  send('POST', path, data, opts, cb);
}

exports.delete = function(url, opts, cb) {
  send('DELETE', path, data, opts, cb);
}

exports.use = function(obj) {
  for (var key in obj) {
    if (defaults.hasOwnProperty(key))
      defaults[key] = obj[key];
  }
}
