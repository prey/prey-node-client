const needle = require('needle');
const https = require('https');
const keys = require('./keys');
const logger = require('./logger');
const common = require('../../../common');

const defaults = {
  client: needle,
  protocol: 'https',
  host: 'solid.preyproject.com',
  user_agent: common.system.user_agent,
  // timeout should be longer than notification server's timeout which is 60 seconds
  // to avoid errors when notify takes a little longer than 60 seconds for cutting the connection
  timeout: 120 * 1000,
  retry_timeout: 3 * 1000,
  try_proxy: '',
};

https.globalAgent.options.secureProtocol = 'TLSv1_2_method';

const api_root = '/api/v2';
const max_attempts = 3;

const is_network_down = function (err) {
  const codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND', 'EHOSTUNREACH'];
  return codes.indexOf(err.code) !== -1;
};

const is_server_down = function (err) {
  const codes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
  return codes.indexOf(err.code) !== -1;
};

const is_temporary_error = function (err, resp) {
  let retry = false;

  if (err) { retry = (is_server_down(err) || err.message.match('socket hang up')); } else { retry = (resp.statusCode == 502 || resp.statusCode == 503); }

  return retry;
};

const send = function (attempt, method, path, data, options, cb) {
  if (!defaults.client) {
    const err = new Error('No HTTP client set!');
    if (cb) return cb(err);
    return err;
  }

  // opts are used for the current request, while options are
  // used in the recursive call in case of retry
  const opts = options || {};
  opts.timeout = opts.timeout || defaults.timeout;
  opts.user_agent = opts.user_agent || defaults.user_agent;

  if (!opts.username) {
    const api_key = keys.get().api;
    opts.username = api_key ? api_key.toString().toLowerCase() : api_key;
    opts.password = 'x';
  }

  const base = `${defaults.protocol}://${defaults.host}`;
  const url = base + api_root + path;
  const start = new Date();
  let logger_msg;

  logger_msg = `Sending ${method} request #${attempt} to ${base}`;
  if (opts.proxy) {
    logger_msg += ` using proxy: ${opts.proxy}`;
  }
  logger.debug(logger_msg);

  if (cb) {
    defaults.client.request(method, url, data, opts, (err, resp, body) => {
      const seconds = (new Date() - start) / 1000;
      const retry_without_proxy = function () {
        delete options.proxy;
        logger.debug('Retrying request without proxy.');
        send(1, method, path, data, options, cb);
      };
      logger.debug(`Attempt #${attempt} took ${seconds} seconds.`);

      if (err && is_network_down(err)) {
        err.message = 'Network seems to be down. Check your connection and try again.';
        if (opts.proxy) {
          return retry_without_proxy();
        }
        return cb(err);
      } if (is_temporary_error(err, resp)) {
        if (attempt < max_attempts) { // retry the request
          logger.debug('Temporary network error. Retrying...');
          return setTimeout(() => {
            send(attempt + 1, method, path, data, options, cb);
          }, defaults.retry_timeout);
        } if (opts.proxy) {
          return retry_without_proxy();
        } if (err) { // maxed out all attempts. tell user to retry in a sec.
          err.message += ' - Please try again in a minute.';
        }
      }

      cb(err, resp, body);
    });
  } else {
    return defaults.client.request(method, url, data, opts);
  }
};

const set_proxy_and_send = function (method, path, data, opts, cb) {
  if (opts && typeof (opts) === 'object' && !opts.hasOwnProperty('proxy') && defaults.try_proxy) {
    opts.proxy = defaults.try_proxy;
    logger.debug(`Setting proxy to ${opts.proxy}`);
  }
  const res = send(1, method, path, data, opts, cb);
  if (!cb) {
    return res;
  }
};

exports.get = function (path, opts, cb) {
  const res = set_proxy_and_send('GET', path, null, opts, cb);
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
  for (const key in obj) {
    if (defaults.hasOwnProperty(key)) {
      if (key == 'protocol' && ['http', 'https'].indexOf(obj[key]) === -1) {
        logger.error(`Invalid protocol: ${obj[key]}`);
        continue;
      }

      if (key !== 'try_proxy' && !obj[key]) {
        logger.error(`Empty API value for key: ${key}`);
        continue;
      }

      defaults[key] = obj[key];
    }
  }
  return defaults;
};
