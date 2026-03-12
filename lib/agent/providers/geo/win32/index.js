const system = require('../../../../system');

exports.get_location = function (cb) {
  system.get_as_admin_user('geoloc', (err, output) => {
    if (err) return cb(err);
    if (!output || output.lat == null || output.lng == null) {
      return cb(new Error('Unable to get location from admin service'));
    }
    return cb(null, output);
  });
};

exports.askLocationNativePermission = function (cb) {
  if (typeof cb === 'function') cb();
};
