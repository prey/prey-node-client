const system = require('../../../../system');

const hasValidCoordinates = (output) => (
  typeof output?.lat === 'number'
  && Number.isFinite(output.lat)
  && typeof output?.lng === 'number'
  && Number.isFinite(output.lng)
);

exports.get_location = (cb) => {
  system.get_as_admin_user('geoloc', (err, output) => {
    if (err) return cb(err);

    const positionSource = typeof output?.position_source === 'string'
      ? output.position_source.trim().toLowerCase()
      : null;

    if (positionSource === 'ipaddress') {
      return cb(new Error('Got ipaddress native'));
    }
    if (!hasValidCoordinates(output)) {
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
