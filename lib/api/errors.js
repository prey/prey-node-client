var list = {
  'MISSING_KEY'        : 'Both API and Device keys are needed.',
  'NO_API_KEY'         : 'No API key set!',
  'API_KEY_SET'        : 'API key already set!',
  'DEVICE_KEY_SET'     : 'Device key already set!',
  'INVALID_DEVICE_KEY' : 'Device not found in database. Please reconfigure.',
  'INVALID_CREDENTIALS': 'Invalid credentials',
  'NO_AVAILABLE_SLOTS' : 'Account is valid, but no available slots are left.'
}

exports.get = function(code) {
  if (!list[code]) return new Error(code);
  var err = new Error(list[code]);
  err.code = code;
  return err;
}

exports.unknown = function(resp) {
  var err = new Error(resp);
  err.code = 'UNKNOWN_RESPONSE';
  return err;
}

exports.validation = function(msg) {
  var err = new Error(msg);
  err.code = 'VALIDATION_ERROR';
  return err;
}
