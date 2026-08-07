// @ts-check
const os = require('os');
const { EventEmitter } = require('events');
const needle = require('needle');
const common = require('../../common');

const logger = common.logger.prefix('mdm_enroll');

const osName = os.platform().replace('darwin', 'mac').replace('win32', 'windows');
let emitter;

const MDM_ENDPOINT = 'http://localhost:7739/action';

const done = (id, err, out) => {
  if (emitter) emitter.emit('end', id, err, out);
  emitter = null;
};

/**
 * @param {string} id
 * @param {{ identifier?: string, secret?: string, discovery_url?: string, opts?: object }|null} opts
 * @param {Function} cb
 */
// eslint-disable-next-line consistent-return
exports.start = (id, opts, cb) => {
  if (osName !== 'windows') {
    return cb(new Error('Action only allowed on Windows'));
  }

  const options = /** @type {any} */ ((opts && opts.opts) || opts || {});
  const { identifier, secret, discovery_url: discoveryUrl } = options;

  if (!identifier) return cb(new Error('Missing required field: identifier'));
  if (!secret) return cb(new Error('Missing required field: secret'));
  if (!discoveryUrl) return cb(new Error('Missing required field: discovery_url'));

  emitter = new EventEmitter();
  cb(null, emitter);

  logger.info(`Starting MDM enrollment for ${identifier}`);

  const payload = {
    action: 'mdm-enroll',
    opts: {
      upn: identifier,
      secret,
      discovery_url: discoveryUrl,
    },
  };

  needle.post(MDM_ENDPOINT, payload, { json: true, timeout: 60000 }, (err, res) => {
    if (err) {
      logger.error(`winsvc request failed: ${err.message}`);
      return done(id, err);
    }

    if (res.statusCode < 200 || res.statusCode >= 300) {
      const error = new Error(`mdm-enroll failed with status ${res.statusCode}`);
      logger.error(error.message);
      return done(id, error);
    }

    let body = res.body || {};
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch (e) {
        logger.warn('Failed to parse winsvc response body');
        body = {};
      }
    }

    if (body.error) {
      const msg = (body.output && body.output.message) || JSON.stringify(body);
      const code = body.output && body.output.code;
      logger.error(`MDM enrollment failed: ${msg} (code: ${code})`);
      return done(id, new Error(`mdm-enroll failed: ${msg}`));
    }

    logger.info(`MDM enrollment succeeded for ${identifier}`);
    return done(id, null, body);
  });
};

exports.stop = () => {};
