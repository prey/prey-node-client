const path = require('path');

const { join } = path;
const system = require('../../system');

const actionLocationWin = 'request-location-permission';
const nodeBin = join(system.paths.current, 'bin', 'node');
const { nameArray } = require('../socket/messages');
const hooks = require('../hooks');

const getLocationPermission = () => {
  const data = [
    'get',
  ];
  system.spawn_as_admin_user(nodeBin, data, (
    errorRequestPermissionWin,
    permissionWindowsLocation,
    // eslint-disable-next-line consistent-return
  ) => {
    if (errorRequestPermissionWin) {
      return;
    }
    if (typeof permissionWindowsLocation !== 'function') return;
    // eslint-disable-next-line consistent-return
    permissionWindowsLocation(
      actionLocationWin,
      data,
      // eslint-disable-next-line consistent-return
      (errPermissionWindowsLocation, outPutpermissionWindowsLocation) => {
        if (errPermissionWindowsLocation || (outPutpermissionWindowsLocation
            && (!Object.prototype.hasOwnProperty.call(outPutpermissionWindowsLocation, 'code')
            || outPutpermissionWindowsLocation.code !== 0))) {
          return;
        }
        hooks.trigger(nameArray[1], [true, outPutpermissionWindowsLocation.Message, () => {}]);
      },
    );
  });
};

exports.getLocationPermission = getLocationPermission;
