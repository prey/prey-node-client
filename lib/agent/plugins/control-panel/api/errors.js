var list = {
  'MISSING_KEY'        : 'Both API and Device keys are needed.',
  'NO_API_KEY'         : 'No API key set! Please run `prey config account setup`.',
  'NO_DEVICE_KEY'      : 'No Device key set!',
  'API_KEY_SET'        : 'API key already set!',
  'DEVICE_KEY_SET'     : 'Device key already set!',
  'INVALID_DEVICE_KEY' : 'Device not found in database. Please reconfigure.',
  'INVALID_CREDENTIALS': 'Invalid credentials.',
  'NO_AVAILABLE_SLOTS' : 'Account is valid, but no available slots are left.',
  'SAME_MISSING_STATE' : 'Missing state already set.'
}

var capitalize = function(key) {
  if (!key) return key;
  return key[0].toUpperCase() + key.slice(1);
}

exports.get = function(code) {
  if (!list[code]) return new Error(code);
  var err = new Error(list[code]);
  err.code = code;
  return err;
}

exports.arguments = function(msg) {
  var err = new Error(msg || 'Invalid arguments.');
  err.code = 'ARGUMENT_ERROR';
  return err;
}

exports.unprocessable = function(errors) {
  if (typeof errors == 'object') {
    var arr = [];
    for (var key in errors) {
      var err_key;
      if (key == 'error') err_key = '';
      else err_key = key == 'password_confirmation' ? 'password: ' : key + ': ';

      if (process.platform == 'win32')
        errors[key].forEach(function(e, index) { errors[key][index] = errors[key][index].replace(/í/g, 'i'); })

      arr.push(capitalize(err_key) + errors[key].join(', '));
    }
    msg = '\n' + arr.join('\n');
  } else {
    msg = errors;
  }

  var err = new Error(msg);
  err.code = 'UNPROCESSABLE_DATA';
  return err;
}

// unknown response code, or body doesn't contain what we expect
exports.unknown = function(resp) {
  var err = new Error(resp.body + ' (' + resp.statusCode + ')');
  err.code = 'UNKNOWN_RESPONSE';
  return err;
}

exports.validation = function(msg) {
  var err = new Error(msg);
  err.code = 'VALIDATION_ERROR';
  return err;
}
