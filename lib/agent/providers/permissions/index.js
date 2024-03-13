const osName = process.platform.replace('darwin', 'mac').replace('win32', 'windows');
// eslint-disable-next-line import/no-dynamic-require
const osFunctions = require(`./${osName}`);

const { getLocationPermission } = osFunctions;

exports.getLocationPermission = getLocationPermission;
