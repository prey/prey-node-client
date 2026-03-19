const system = require('../../../../system');
const logger = require('../../../common').logger.prefix('location-native');

const hasValidCoordinates = (output) => (
  typeof output?.lat === 'number'
  && Number.isFinite(output.lat)
  && typeof output?.lng === 'number'
  && Number.isFinite(output.lng)
);

const hasAllowedAccuracy = (output) => (
  typeof output?.accuracy !== 'number'
  || !Number.isFinite(output.accuracy)
  || output.accuracy <= 100
);
exports.get_location = (cb) => {
  // eslint-disable-next-line consistent-return
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
    if (!hasAllowedAccuracy(output)) {
      return cb(new Error('Accuracy from admin service exceeds maximum allowed value (100)'));
    }
    logger.info(`Location native obtained from admin service with ${output?.position_source} and ${output?.source}`);
    const outputFinal = {
      lat: output.lat,
      lng: output.lng,
      accuracy: output.accuracy || null,
      method: output.method || null,
    };
    cb(null, outputFinal);
  });
};

exports.askLocationNativePermission = (cb) => {
  if (typeof cb === 'function') cb();
};
