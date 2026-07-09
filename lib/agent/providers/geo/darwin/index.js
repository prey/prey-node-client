const { join } = require('path');
const common = require('../../../common');
const socket = require('../../../socket');
const { nameArray } = require('../../../socket/messages');
const configutil = require('../../../../utils/configutil');

const app = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');
const { system } = common;
const runAsUser = system.run_as_logged_user;
const { greaterOrEqual } = common.helpers;

const parseResponse = (data, cb) => {
  try {
    const responseData = data.result.messages[1].message;
    if (Object.prototype.hasOwnProperty.call(responseData, 'accuracy')) responseData.accuracy = parseFloat(responseData.accuracy).toFixed(6);
    return cb(null, responseData);
  } catch (errExcept) {
    return cb(new Error(errExcept.message));
  }
};

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

const doCallSocket = (cb) => {
  socket.writeMessage(nameArray[0], (err, data) => {
    if (err) {
      return getLocationOld(cb);
    }
    return parseResponse(data, cb);
  }, NATIVE_LOCATION_TIMEOUT);
};

// Dedupes concurrent callers onto a single in-flight native location request instead of
// starting a second one — two simultaneous CLLocationManager registrations under the same
// client identity leave locationd's WifiLoc provider stuck for every future request.
const callSocket = (cb) => {
  if (inFlightCallbacks) {
    inFlightCallbacks.push(cb);
    return;
  }
  inFlightCallbacks = [cb];
  doCallSocket((err, data) => {
    const waiters = inFlightCallbacks;
    inFlightCallbacks = null;
    waiters.forEach((waiterCb) => waiterCb(err, data));
  });
}

const getLocation = (cb) => {
  // eslint-disable-next-line consistent-return
  system.get_os_version((_err, version) => {
    if (version && greaterOrEqual(version, '10.6.0')) {
      configutil.getDataDbKey('skippedPermissions', (err, skippedPermissions) => {
        if (err) return callSocket(cb);

        try {
          if (skippedPermissions && JSON.parse(skippedPermissions[0].value).location == "true")
            return cb(new Error('Location permission skipped'));
        } catch (e) {
          return callSocket(cb);
        }

        callSocket(cb);
      })
    } else {
      return cb(new Error('Not yet supported'));
    }
  });
};

const askLocationNativePermission = (cb) => {
  socket.writeMessage(nameArray[0], (err, data) => {
    if (err) return cb(err);
    return cb(null, data);
  }, 31000);
};

exports.get_location = getLocation;
exports.askLocationNativePermission = askLocationNativePermission;
