const { nameArray } = require('../socket/messages');
const hooks = require('../hooks');

const getLocationPermission = (cb) => {
  const hookData = [
    nameArray[1], // 'location-check-location-perms'
    'Allow', // Permission granted
    cb || (() => {}), // Callback (optional)
  ];
  hooks.trigger(nameArray[1], hookData);
};

exports.getLocationPermission = getLocationPermission;
