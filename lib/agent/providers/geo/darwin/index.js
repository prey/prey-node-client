const { join } = require('path');
const common = require('../../../common');
const socket = require('../../../socket');

const app = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');
const { system } = common;
const runAsUser = system.run_as_logged_user;
const { greaterOrEqual } = common.helpers;
const { removeBackslash } = require('../../../utils/utilsprey');

const parseResponse = (data, cb) => {
  let response;
  try {
    const responseData = removeBackslash(typeof data === 'object' ? data.result : data);
    response = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
    if (Object.prototype.hasOwnProperty.call(response, 'accuracy')) response.accuracy = parseFloat(response.accuracy).toFixed(6);
    return cb(null, response);
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

const getLocation = (cb) => {
  // eslint-disable-next-line consistent-return
  system.get_os_version((_err, version) => {
    if (version && greaterOrEqual(version, '10.6.0')) {
      socket.writeMessage('get-location-native', (err, data) => {
        if (err) return getLocationOld(cb);
        return parseResponse(data, cb);
      });
    } else {
      return cb(new Error('Not yet supported'));
    }
  });
};

const askLocationNativePermission = (cb) => {
  socket.writeMessage('get-location-native', (err, data) => {
    if (err) return cb(err);
    return cb(null, data);
  });
};

exports.get_location = getLocation;
exports.askLocationNativePermission = askLocationNativePermission;
