const { EventEmitter } = require('events');
const path = require('path');
const socket = require('../../socket');
const geoIndex = require('../../providers/geo');
const strategies = require('../../providers/geo/strategies');
const permissionFile = require('../../../utils/permissionfile');

const osName = process.platform.replace('win32', 'windows').replace('darwin', 'mac');
const { nameArray } = require('../../socket/messages');

const { join } = path;
const system = require('../../../system');

const nodeBin = join(system.paths.current, 'bin', 'node');

const actionLocationWin = 'location-permission';

let emitter;

const parseResponse = (data, cb) => {
  try {
    const responseData = data.result.messages[1].message;
    if (Object.prototype.hasOwnProperty.call(responseData, 'accuracy')) responseData.accuracy = parseFloat(responseData.accuracy).toFixed(6);
    return cb(null);
  } catch (errExcept) {
    return cb(new Error(errExcept.message));
  }
};

const done = (id, err) => {
  if (!emitter) emitter = new EventEmitter();
  emitter.emit('end', id, err);
};

// eslint-disable-next-line consistent-return
const requestAllowPermissionWin = (cb) => {
  if (osName.localeCompare('windows') !== 0) return cb(new Error('Action only allowed on windows'));
  const data = [
    'allow',
  ];
  system.spawn_as_admin_user(nodeBin, data, (
    errorRequestPermissionWin,
    permissionWindowsLocation,
  // eslint-disable-next-line consistent-return
  ) => {
    if (errorRequestPermissionWin) {
      return done(new Error(errorRequestPermissionWin));
    }
    if (typeof permissionWindowsLocation !== 'function') return done(new Error('Error is not available'));
    // eslint-disable-next-line consistent-return
    permissionWindowsLocation(
      actionLocationWin,
      data,
      // eslint-disable-next-line consistent-return
      (errPermissionWindowsLocation, outPutpermissionWindowsLocation) => {
        if (errPermissionWindowsLocation || (outPutpermissionWindowsLocation
        && (!Object.prototype.hasOwnProperty.call(outPutpermissionWindowsLocation, 'code')
        || outPutpermissionWindowsLocation.code !== 0))) {
          const errorOutPut = new Error('Error on osQuery');
          return done(errorOutPut);
        }
        done();
      },
    );
  });
};

/**
 * Requests native permission on MacOS.
 *
 * @param {function} cb - The callback function to be executed after the permission is requested.
 * @return {void}
 */
// eslint-disable-next-line consistent-return
const requestNativePermission = (cb) => {
  if (osName.localeCompare('mac') !== 0) return cb(new Error('Action only allowed on MacOS'));
  // eslint-disable-next-line consistent-return
  socket.writeMessage(nameArray[1], () => {
    const permissionNative = permissionFile.getData('nativeLocation');
    if (permissionNative.localeCompare('false') !== 0 && permissionNative.localeCompare('true') !== 0) {
      try {
        strategies.askLocationNativePermission((err, data) => {
          parseResponse(data, (errParse) => {
            if (!errParse) geoIndex.getLocationRequest(() => {});
          });
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
/**
 * Starts the process based on the provided ID and options.
 *
 * @param {type} id - The ID for the process
 * @param {type} opts - The options for the process
 * @param {type} cb - Callback function
 * @return {type} description of return value
 */
// eslint-disable-next-line consistent-return
exports.start = (id, opts, cb) => {
  // eslint-disable-next-line consistent-return
  cb();
  if (!opts.name) return done(id, new Error('Invalid permission name'));
  switch (opts.name) {
    case 'native_location':
      requestNativePermission((err) => done(id, err));
      break;
    case 'wifi_location':
      requestAllowPermissionWin((err) => done(id, err));
      break;
    default:
      done(id, new Error('Invalid permission name'));
  }
};

exports.stop = () => {
};
