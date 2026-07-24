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

const capitalize = function (key) {
  if (!key) return key;
  return key[0].toUpperCase() + key.slice(1);
};

exports.get = function (code) {
  if (!list[code]) return new Error(code);
  const err = new Error(list[code]);
  err.code = code;
  err.level = 'not fatal';
  return err;
};

exports.arguments = function (msg) {
  const err = new Error(msg || 'Invalid arguments.');
  err.code = 'ARGUMENT_ERROR';
  err.level = 'not fatal';
  return err;
};

exports.unprocessable = function (errors) {
  if (typeof errors === 'object') {
    const arr = [];
    for (var key in errors) {
      var err_key;
      if (key == 'error') err_key = '';
      else err_key = key == 'password_confirmation' ? 'password: ' : `${key}: `;

      if (process.platform == 'win32') errors[key].forEach((e, index) => { errors[key][index] = errors[key][index].replace(/í/g, 'i'); });

      arr.push(capitalize(err_key) + errors[key].join(', '));
    }
    msg = `\n${arr.join('\n')}`;
  } else {
    msg = errors;
  }

  const err = new Error(msg);
  err.code = 'UNPROCESSABLE_DATA';
  err.level = 'not fatal';
  return err;
};

// unknown response code, or body doesn't contain what we expect
exports.unknown = function (resp) {
  const body = typeof resp.body === 'object' ? JSON.stringify(resp.body) : resp.body;
  const err = new Error(`${body} (${resp.statusCode})`);
  err.code = 'UNKNOWN_RESPONSE';
  err.level = 'not fatal';
  return err;
};

exports.validation = function (msg) {
  const err = new Error(msg);
  err.code = 'VALIDATION_ERROR';
  err.level = 'not fatal';
  return err;
};
