// @ts-check

/**
 * @typedef {Error & { code?: string, level?: string, statusCode?: number }} ApiError
 */

/** @type {Record<string, string>} */
const list = {
  MISSING_KEY: 'Both API and Device keys are needed.',
  NO_API_KEY: 'No API key set! Please run `prey config account setup`.',
  NO_DEVICE_KEY: 'No Device key set!',
  API_KEY_SET: 'API key already set!',
  DEVICE_KEY_SET: 'Device key already set!',
  INVALID_DEVICE_KEY: 'Device not found in database. Please reconfigure.',
  INVALID_CREDENTIALS: 'Invalid credentials.',
  NO_AVAILABLE_SLOTS: 'Account is valid, but no available slots are left.',
  SAME_MISSING_STATE: 'Missing state already set.',
};

/**
 * @param {string} key
 * @returns {string}
 */
const capitalize = function (key) {
  if (!key) return key;
  return key[0].toUpperCase() + key.slice(1);
};

/**
 * @param {string} code
 * @returns {ApiError}
 */
exports.get = function (code) {
  if (!list[code]) return new Error(code);
  /** @type {ApiError} */
  const err = new Error(list[code]);
  err.code = code;
  err.level = 'not fatal';
  return err;
};

/**
 * @param {string} [msg]
 * @returns {ApiError}
 */
exports.arguments = function (msg) {
  /** @type {ApiError} */
  const err = new Error(msg || 'Invalid arguments.');
  err.code = 'ARGUMENT_ERROR';
  err.level = 'not fatal';
  return err;
};

/**
 * @param {Record<string, string[]>|string} errors
 * @returns {ApiError}
 */
exports.unprocessable = function (errors) {
  let msg;
  if (typeof errors === 'object') {
    const arr = [];
    for (const key in errors) {
      let err_key;
      if (key == 'error') err_key = '';
      else err_key = key == 'password_confirmation' ? 'password: ' : `${key}: `;

      if (process.platform == 'win32') errors[key].forEach((e, index) => { errors[key][index] = errors[key][index].replace(/í/g, 'i'); });

      arr.push(capitalize(err_key) + errors[key].join(', '));
    }
    msg = `\n${arr.join('\n')}`;
  } else {
    msg = errors;
  }

  /** @type {ApiError} */
  const err = new Error(msg);
  err.code = 'UNPROCESSABLE_DATA';
  err.level = 'not fatal';
  return err;
};

/**
 * Unknown response code, or body doesn't contain what we expect. The HTTP status is
 * exposed as `statusCode` so callers can tell a client error (4xx) from a server
 * outage (5xx) without parsing the message.
 * @param {{ body?: *, statusCode?: number }} resp
 * @returns {ApiError}
 */
exports.unknown = function (resp) {
  const body = typeof resp.body === 'object' ? JSON.stringify(resp.body) : resp.body;
  /** @type {ApiError} */
  const err = new Error(`${body} (${resp.statusCode})`);
  err.code = 'UNKNOWN_RESPONSE';
  err.level = 'not fatal';
  err.statusCode = resp.statusCode;
  return err;
};

/**
 * @param {string} msg
 * @returns {ApiError}
 */
exports.validation = function (msg) {
  /** @type {ApiError} */
  const err = new Error(msg);
  err.code = 'VALIDATION_ERROR';
  err.level = 'not fatal';
  return err;
};
