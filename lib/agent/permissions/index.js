const osName = process.platform.replace('win32', 'windows');
// eslint-disable-next-line import/no-dynamic-require
const osFunctions = require(`./${osName}`);

const { getLocationPermission, requestNativeLocation } = osFunctions;

exports.getLocationPermission = getLocationPermission;
exports.requestNativeLocation = requestNativeLocation;
