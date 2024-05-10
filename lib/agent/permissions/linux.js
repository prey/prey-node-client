const getLocationPermission = () => {
};

const requestNativeLocation = (cb) => {
  if (!cb || typeof cb !== 'function') return;
  cb();
};

exports.getLocationPermission = getLocationPermission;
exports.requestNativeLocation = requestNativeLocation;
