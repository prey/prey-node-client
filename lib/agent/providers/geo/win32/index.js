// Native geolocation is not supported on Windows.
// The system will automatically fallback to wifi or geoip strategies.

exports.get_location = function(cb) {
  cb(new Error('Native geolocation is not supported on Windows'));
};

exports.askLocationNativePermission = function(cb) {
  if (typeof cb === 'function') cb();
};
