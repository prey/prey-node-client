const needle = require('needle');
const https = require('https');
const logger = require('./logger');
const common = require('../../../common');
const system = require('../../../system');

var defaults = {
  client: needle,
  protocol: 'https',
  host: 'solid.preyproject.com',
  user_agent: system.user_agent,
  // timeout should be longer than notification server's timeout which is 60 seconds
  // to avoid errors when notify takes a little longer than 60 seconds for cutting the connection
  timeout: 120 * 1000,
  retry_timeout: 3 * 1000,
  try_proxy: '',
};

https.globalAgent.options.secureProtocol = 'TLSv1_2_method';

var api_root = '/api/v2',
  max_attempts = 3;

var is_network_down = function (err) {
  var codes = [
    'ENETDOWN',
    'ENETUNREACH',
    'EADDRINFO',
    'ENOTFOUND',
    'EHOSTUNREACH',
  ];
  return codes.indexOf(err.code) !== -1;
};

var is_server_down = function (err) {
  var codes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
  return codes.indexOf(err.code) !== -1;
};

var is_temporary_error = function (err, resp) {
  var retry = false;

  if (err) retry = is_server_down(err) || err.message.match('socket hang up');
  else retry = resp.statusCode == 502 || resp.statusCode == 503;

  return retry;
};

var send = function (attempt, method, path, data, options, cb) {
  if (!defaults.client) {
    var err = new Error('No HTTP client set!');
    if (cb) return cb(err);
    return err;
  }

  // opts are used for the current request, while options are
  // used in the recursive call in case of retry
  var opts = options || {};
  opts.timeout = opts.timeout || defaults.timeout;
  opts.user_agent = opts.user_agent || defaults.user_agent;

  if (!opts.username) {
    var api_key = common.config.get('control-panel.api_key').toString()
    opts.username = api_key ? api_key.toString().toLowerCase() : api_key;
    opts.password = 'x';
  }

  var base = defaults.protocol + '://' + defaults.host,
    url = base + api_root + path,
    start = new Date(),
    logger_msg;
  logger_msg = 'Sending ' + method + ' request #' + attempt + ' to ' + base;
  if (opts.proxy) {
    logger_msg += ' using proxy: ' + opts.proxy;
  }
  logger.debug(logger_msg);
  if (cb) {
    defaults.client.request(
      method,
      url,
      data,
      opts,
      function (err, resp, body) {
        var seconds = (new Date() - start) / 1000,
          retry_without_proxy = function () {
            delete options.proxy;
            logger.debug('Retrying request without proxy.');
            send(1, method, path, data, options, cb);
          };
        logger.debug('Attempt #' + attempt + ' took ' + seconds + ' seconds.');

        if (err && is_network_down(err)) {
          err.message =
            'Network seems to be down. Check your connection and try again.';
          if (opts.proxy) {
            return retry_without_proxy();
          }
          return cb(err);
        } else if (is_temporary_error(err, resp)) {
          if (attempt < max_attempts) {
            // retry the request
            logger.debug('Temporary network error. Retrying...');
            return setTimeout(function () {
              send(attempt + 1, method, path, data, options, cb);
            }, defaults.retry_timeout);
          } else if (opts.proxy) {
            return retry_without_proxy();
          } else if (err) {
            // maxed out all attempts. tell user to retry in a sec.
            err.message = err.message + ' - Please try again in a minute.';
          }
        }

        cb(err, resp, body);
      }
    );
  } else {
    return defaults.client.request(method, url, data, opts);
  }
};

var set_proxy_and_send = function (method, path, data, opts, cb) {
  if (!opts.hasOwnProperty('proxy') && defaults.try_proxy) {
    opts.proxy = defaults.try_proxy;
    logger.debug('Setting proxy to ' + opts.proxy);
  }
  var res = send(1, method, path, data, opts, cb);
  if (!cb) {
    return res;
  }
};

exports.get = function (path, opts, cb) {
  var res = set_proxy_and_send('GET', path, null, opts, cb);
  if (!cb) {
    return res;
  }
};

exports.post = function (path, data, opts, cb) {
  set_proxy_and_send('POST', path, data, opts, cb);
};

exports.delete = function (path, opts, cb) {
  set_proxy_and_send('DELETE', path, null, opts, cb);
};

exports.use = function (obj) {
  for (var key in obj) {
    if (defaults.hasOwnProperty(key)) {
      if (key == 'protocol' && ['http', 'https'].indexOf(obj[key]) === -1) {
        logger.error('Invalid protocol: ' + obj[key]);
        continue;
      }

      if (key !== 'try_proxy' && !obj[key]) {
        logger.error('Empty API value for key: ' + key);
        continue;
      }

      defaults[key] = obj[key];
    }
  }
  return defaults;
};
