const system = require('../../../../system');
const logger = require('../../../common').logger.prefix('location-native');
const hooks = require('../../../hooks');

const hasValidCoordinates = (output) => (
  typeof output?.lat === 'number'
  && Number.isFinite(output.lat)
  && typeof output?.lng === 'number'
  && Number.isFinite(output.lng)
);

exports.get_location = (cb) => {
  // eslint-disable-next-line consistent-return
  system.get_as_admin_user('geoloc', (err, output) => {
    if (err) return cb(err);

    const positionSource = typeof output?.position_source === 'string'
      ? output.position_source.trim().toLowerCase()
      : null;

    if (positionSource === 'ipaddress') {
      const errorPositionSource = new Error('Got ipaddress native');
      errorPositionSource.extra = {
        accuracy: output.accuracy,
        positionSource: output?.position_source,
        source: output?.source,
      };
      hooks.trigger('error', errorPositionSource);
      return cb(errorPositionSource);
    }
    if (typeof output === 'string' && output === 'unknown provider: geoloc') {
      const errorUnknown = new Error('No provider for geoloc native');
      logger.info('No provider for geoloc native - WinSVC version outdated');
      return cb(errorUnknown);
    }
    if (!hasValidCoordinates(output)) {
      const errorValid = new Error('Invalid coordinates from admin service');
      errorValid.extra = {
        accuracy: output?.accuracy,
        positionSource: output?.position_source,
        source: output?.source,
      };
      hooks.trigger('error', errorValid);
      return cb(errorValid);
    }
    logger.info(`Location native obtained from admin service with ${output?.position_source} and ${output?.source}`);
    logger.debug(`[WIN32-NATIVE] Coordinates validated: lat=${output.lat}, lng=${output.lng}, accuracy=${output.accuracy ?? null}m`);
    cb(null, {
      lat: output.lat,
      lng: output.lng,
      accuracy: output.accuracy ?? null,
      method: output.method || null,
    });
  });
};

exports.askLocationNativePermission = (cb) => {
  if (typeof cb === 'function') cb();
};
