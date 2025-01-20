const needle = require('needle');
const https = require('https');
const keys = require('./keys');
const common = require('../../../common');
const config = require('../../../utils/configfile');
const logger = common.logger.prefix('api');

const defaults = {
  client: needle,
  protocol: config.getData('control-panel.protocol'),
  host: config.getData('control-panel.host'),
  user_agent: common.system.user_agent,
  timeout: 120 * 1000,
  retry_timeout: 3 * 1000,
  try_proxy: '',
};


https.globalAgent.options.secureProtocol = 'TLSv1_2_method';

const api_root = '/api/v2';
const max_attempts = 3;

const is_network_down =  (err) => {
  const codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND', 'EHOSTUNREACH'];
  return codes.indexOf(err.code) !== -1;
};

const is_server_down = (err) => {
  const codes = ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED'];
  return codes.indexOf(err.code) !== -1;
};

const is_temporary_error = (err, resp) => {
  let retry = false;

  if (err) { retry = (is_server_down(err) || err.message.match('socket hang up')); } else { retry = (resp.statusCode == 502 || resp.statusCode == 503); }

  return retry;
};

exports.send = (attempt, method, path, data, options, cb) => {
  if (!defaults.client) {
    const err = new Error('No HTTP client set!');
    if (cb) return cb(err);
    return err;
  }

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
      const retry_without_proxy = () => {
        delete options.proxy;
        logger.debug('Retrying request without proxy.');
        exports.send(1, method, path, data, options, cb);
      };
      logger.debug(`Attempt #${attempt} took ${seconds} seconds.`);

      if (err && is_network_down(err)) {
        err.message = 'Network seems to be down. Check your connection and try again.';
        if (opts.proxy) {
          return retry_without_proxy();
        }
        return cb(err);
      } 
      if (is_temporary_error(err, resp)) {
        if (attempt < max_attempts) {
          logger.debug('Temporary network error. Retrying...');
          return setTimeout(() => {
            exports.send(attempt + 1, method, path, data, options, cb);
          }, defaults.retry_timeout);
        }
        if (opts.proxy) {
          return retry_without_proxy();
        }
        if (err) {
          err.message += ' - Please try again in a minute.';
        }
      }

      cb(err, resp, body);
    });
  } else {
    return defaults.client.request(method, url, data, opts);
  }
};

const set_proxy_and_send = (method, path, data, opts, cb) => {
  if (opts && typeof (opts) === 'object' && !opts.hasOwnProperty('proxy') && defaults.try_proxy) {
    opts.proxy = defaults.try_proxy;
    logger.debug(`Setting proxy to ${opts.proxy}`);
  }
  const res = exports.send(1, method, path, data, opts, cb);
  if (!cb) {
    return res;
  }
};

exports.get = (path, opts, cb) => {
  const res = set_proxy_and_send('GET', path, null, opts, cb);
  if (!cb) {
    return res;
  }
};

exports.post = (path, data, opts, cb) => {
  set_proxy_and_send('POST', path, data, opts, cb);
};

exports.delete = (path, opts, cb) => {
  set_proxy_and_send('DELETE', path, null, opts, cb);
};

exports.use = (obj) => {
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
