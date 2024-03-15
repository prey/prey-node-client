const socket = require('../socket');

const permissionFunction = 'check-location-perms';
const getLocationPermission = () => {
  socket.writeMessage(permissionFunction);
};

exports.getLocationPermission = getLocationPermission;
