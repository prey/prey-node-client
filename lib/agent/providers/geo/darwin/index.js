// @ts-check
const { join } = require('path');
const common = require('../../../common');
const socket = require('../../../socket');
const { nameArray } = require('../../../socket/messages');
const configutil = require('../../../../utils/configutil');

const app = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');
const { system } = common;
const runAsUser = system.run_as_logged_user;
const { greaterOrEqual } = common.helpers;

/**
 * Parses the native location response and invokes the callback with the location data.
 *
 * @param {any} data - Raw response object from the native location service
 * @param {function} cb - Node.js error-first callback: (err, locationData)
 * @return {void}
 */
const parseResponse = (data, cb) => {
  try {
    const responseData = data.result.messages[1].message;
    if (Object.prototype.hasOwnProperty.call(responseData, 'accuracy')) responseData.accuracy = parseFloat(responseData.accuracy).toFixed(6);
    return cb(null, responseData);
  } catch (errExcept) {
    return cb(new Error(errExcept.message));
  }
};

/**
 * Fetches location using the legacy Prey.app companion binary (macOS < 10.6 fallback).
 *
 * @param {function} cb - Node.js error-first callback: (err, locationData)
 * @return {void}
 */
const getLocationOld = (cb) => {
  const bin = join(app, 'Contents', 'MacOS', 'Prey');
  const args = ['-location'];
  try {
    runAsUser(bin, args, { timeout: 120000 }, (errRun, data) => {
      if (errRun || (data && data.includes('error'))) return cb(new Error('Unable to get native location'));
      return parseResponse(data, cb);
    });
  } catch (err) {
    cb(new Error(err.message));
  }
};

// Ceiling for the native location roundtrip through macsvc (which itself allows up to
// 60s for the Prey.app companion, see Go/macsvc/usercontext.go DefaultAppTimeout), plus
// headroom for the launchctl asuser roundtrip. Must stay above that ceiling: a shorter
// timeout here falls back to getLocationOld() while the in-flight macsvc request is still
// running, registering a second concurrent CLLocationManager client and wedging locationd.
const NATIVE_LOCATION_TIMEOUT = 65000;

let inFlightCallbacks = null;

/**
 * Sends the native location request through the Unix socket,
 * falling back to the legacy Prey.app binary on socket error.
 *
 * @param {function} cb - Node.js error-first callback: (err, locationData)
 * @return {void}
 */
const doCallSocket = (cb) => {
  socket.writeMessage(nameArray[0], (err, data) => {
    if (err) {
      return getLocationOld(cb);
    }
    return parseResponse(data, cb);
  }, NATIVE_LOCATION_TIMEOUT);
};

/**
 * Deduplicates concurrent callers onto a single in-flight native location request.
 * Two simultaneous CLLocationManager registrations under the same client identity
 * leave locationd's WifiLoc provider stuck for every future request.
 *
 * @param {function} cb - Node.js error-first callback: (err, locationData)
 * @return {void}
 */
const callSocket = (cb) => {
  if (inFlightCallbacks) {
    inFlightCallbacks.push(cb);
    return;
  }
  inFlightCallbacks = [cb];
  doCallSocket((err, data) => {
    const waiters = inFlightCallbacks;
    inFlightCallbacks = null;
    if (waiters) waiters.forEach((waiterCb) => waiterCb(err, data));
  });
};

/**
 * Gets the current device location using the native macOS location service.
 * Checks skipped permissions before attempting the socket request.
 *
 * @param {function} cb - Node.js error-first callback: (err, locationData)
 * @return {void}
 */
const getLocation = (cb) => {
  // eslint-disable-next-line consistent-return
  system.get_os_version((_err, version) => {
    if (version && greaterOrEqual(version, '10.6.0')) {
      // eslint-disable-next-line consistent-return
      configutil.getDataDbKey('skippedPermissions', (err, skippedPermissions) => {
        if (err) return callSocket(cb);

        try {
          if (skippedPermissions && JSON.parse(skippedPermissions[0].value).location === 'true') {
            return typeof cb === 'function' && cb(new Error('Location permission skipped'));
          }
        } catch (e) {
          return callSocket(cb);
        }

        callSocket(cb);
      });
    } else {
      return typeof cb === 'function' && cb(new Error('Not yet supported'));
    }
  });
};

/**
 * Requests native location permission via the macOS socket service.
 *
 * @param {function} cb - Node.js error-first callback: (err, data)
 * @return {void}
 */
const askLocationNativePermission = (cb) => {
  socket.writeMessage(nameArray[0], (err, data) => {
    if (err) return typeof cb === 'function' && cb(err);
    return typeof cb === 'function' && cb(null, data);
  }, 31000);
};

exports.get_location = getLocation;
exports.askLocationNativePermission = askLocationNativePermission;
