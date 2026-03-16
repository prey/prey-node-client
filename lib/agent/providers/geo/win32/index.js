const system = require('../../../../system');

exports.get_location = (cb) => {
  system.get_as_admin_user('geoloc', (err, output) => {
    if (err) return cb(err);

    if (output?.position_source.toLowerCase() === 'ipaddress') {
      return cb(new Error('Got ipaddress native'));
    }
    if (output?.lat == null || output?.lng == null) {
      return cb(new Error('Unable to get location from admin service'));
    }
    // eslint-disable-next-line global-require
    const logger = require('../../../common').logger.prefix('location-native');
    logger.info(`Location native obtained from admin service with ${output?.position_source} and ${output?.source}`);
    const outputFinal = {
      lat: output.lat,
      lng: output.lng,
      accuracy: output.accuracy || null,
      method: output.method || null,
    };
    return cb(null, outputFinal);
  });
};

exports.askLocationNativePermission = (cb) => {
  if (typeof cb === 'function') cb();
};
