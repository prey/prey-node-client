const socket = require('../socket');

const { nameArray } = require('../socket/messages');
/**
 * Executes the `getLocationPermission` function.
 *
 * @param {type} paramName - description of parameter
 * @return {type} description of return value
 */
const getLocationPermission = () => {
  socket.writeMessage(nameArray[1]);
};

exports.getLocationPermission = getLocationPermission;
