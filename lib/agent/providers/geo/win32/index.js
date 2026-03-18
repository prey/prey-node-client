const needle = require('needle');
const system = require('../../../../system');
const keys = require('../../../control-panel/api/keys');
const config = require('../../../../utils/configfile');
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

const geoEndpoint = `https://${config.getData('control-panel.host')}/geo`;

const sendLocationToGeoEndpoint = (locData, cb) => {
  const optsPut = {
    user_agent: system.user_agent,
    json: true,
    username: keys.get().device,
    password: keys.get().api,
  };
  // eslint-disable-next-line consistent-return
  needle.put(geoEndpoint, locData, optsPut, (errPut) => {
    if (errPut) {
      logger.info(`Failed sending raw location to ${geoEndpoint}: ${errPut.message}`);
      return cb();
    }
    logger.debug('Raw location sent to geo endpoint successfully');
    return cb();
  });
};
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
      strategy: output?.position_source || null,
    };
    sendLocationToGeoEndpoint(outputFinal, () => cb(null, outputFinal));
  });
};

exports.askLocationNativePermission = (cb) => {
  if (typeof cb === 'function') cb();
};
