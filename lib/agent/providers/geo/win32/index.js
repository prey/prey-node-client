// @ts-check
const system = require('../../../../system');
const logger = require('../../../common').logger.prefix('location-native');
// hooks exposes a custom `trigger` method not present on the base EventEmitter type.
const hooks = /** @type {any} */ (require('../../../hooks'));

const hasValidCoordinates = (output) => (
  typeof output?.lat === 'number'
  && Number.isFinite(output.lat)
  && typeof output?.lng === 'number'
  && Number.isFinite(output.lng)
);

let lastPositionSource = 'unknown';

/**
 * Gets a native geolocation fix from the privileged admin service and returns it
 * to the caller. The returned object carries `position_source` (the normalized
 * WinRT position source, e.g. 'gps'/'wifi'/'cellular', or null) as a LOCAL-ONLY
 * field: it is persisted to the local location audit DB but stripped before any
 * send to the control panel.
 *
 * @param {(err: Error|null, result?: object) => void} cb
 * @returns {void}
 */
exports.get_location = (cb) => {
  // eslint-disable-next-line consistent-return
  system.get_as_admin_user('geoloc', (err, output) => {
    if (err) {
      /** @type {any} */ (err).level = 'not fatal';
      return cb(err);
    }

    const positionSource = typeof output?.position_source === 'string'
      ? output.position_source.trim().toLowerCase()
      : null;
    const sourceOutput = typeof output?.source === 'string'
      ? output.source.trim().toLowerCase()
      : null;
    if ((typeof sourceOutput === 'string' && sourceOutput !== 'winrt')
      || (typeof positionSource === 'string' && positionSource === 'ipaddress')) {
      const errorPositionSource = /** @type {any} */ (new Error('Got ipaddress native or non-WINRT source, which is not accurate'));
      errorPositionSource.extra = {
        accuracy: output.accuracy,
        positionSource: output?.position_source,
        source: output?.source,
      };
      errorPositionSource.level = 'not fatal';
      hooks.trigger('error', errorPositionSource);
      return cb(errorPositionSource);
    }
    if (typeof output === 'string' && output === 'unknown provider: geoloc') {
      const errorUnknown = new Error('No provider for geoloc native');
      logger.info('No provider for geoloc native - WinSVC version outdated');
      return cb(errorUnknown);
    }
    if (!hasValidCoordinates(output)) {
      const errorValid = /** @type {any} */ (new Error('Invalid coordinates from admin service'));
      errorValid.extra = {
        accuracy: output?.accuracy,
        positionSource: output?.position_source,
        source: output?.source,
      };
      errorValid.level = 'not fatal';
      hooks.trigger('error', errorValid);
      return cb(errorValid);
    }
    logger.info(`Location native obtained from admin service with ${output?.position_source} and ${output?.source}`);
    logger.debug(`[WIN32-NATIVE] Coordinates validated: lat=${output.lat}, lng=${output.lng}, accuracy=${output.accuracy ?? null}m`);
    lastPositionSource = positionSource || 'unknown';
    cb(null, {
      lat: output.lat,
      lng: output.lng,
      accuracy: output.accuracy ?? null,
      method: output.method || null,
      // Local-only: persisted to the audit DB (`source` column), stripped before any server send.
      position_source: positionSource,
    });
  });
};

exports.getLastPositionSource = () => lastPositionSource;

exports.askLocationNativePermission = (cb) => {
  if (typeof cb === 'function') cb();
};
