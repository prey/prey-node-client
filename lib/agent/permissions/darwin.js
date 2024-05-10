const socket = require('../socket');

const permissionFile = require('../../utils/permissionfile');

// eslint-disable-next-line camelcase
const { get_location } = require('../providers/geo/darwin');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const permissionFunction = 'check-location-perms';
/**
 * Executes the `getLocationPermission` function.
 *
 * @param {type} paramName - description of parameter
 * @return {type} description of return value
 */
const getLocationPermission = () => {
  socket.writeMessage(permissionFunction);
};

// eslint-disable-next-line consistent-return
const requestNativePermission = (cb) => {
  if (osName.localeCompare('mac') !== 0) return cb(new Error('Action only allowed on MacOS'));
  // eslint-disable-next-line consistent-return
  socket.writeMessage(permissionFunction, () => {
    const permissionNative = permissionFile.getData('nativeLocation');
    if (permissionNative.localeCompare('false') !== 0 && permissionNative.localeCompare('true') !== 0) {
      try {
        get_location((err) => {
          cb(err);
        });
      } catch (ex) {
        cb(new Error(ex.message));
      }
    } else {
      cb(null);
    }
  });
};

exports.getLocationPermission = getLocationPermission;
exports.requestNativePermission = requestNativePermission;
