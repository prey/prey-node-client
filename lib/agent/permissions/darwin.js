const socket = require('../socket');

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

exports.getLocationPermission = getLocationPermission;
