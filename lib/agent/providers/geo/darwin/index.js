const { join } = require('path');
const common = require('../../../common');
const socket = require('../../../socket');
const { nameArray } = require('../../../socket/messages');

const app = join(__dirname, '..', '..', '..', 'utils', 'Prey.app');
const { system } = common;
const runAsUser = system.run_as_logged_user;
const { greaterOrEqual } = common.helpers;
const logger = common.logger.prefix('[][][][]');

const parseResponse = (data, cb) => {
  try {
    const responseData = data.result.messages[1].message;
    if (Object.prototype.hasOwnProperty.call(responseData, 'accuracy')) responseData.accuracy = parseFloat(responseData.accuracy).toFixed(6);
    return cb(null, responseData);
  } catch (errExcept) {
    logger.info(`ERROR in parseResponse ${errExcept}`);
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
  logger.info('Asking for location data');
  // eslint-disable-next-line consistent-return
  system.get_os_version((_err, version) => {
    if (version && greaterOrEqual(version, '10.6.0')) {
      socket.writeMessage(nameArray[0], (err, data) => {
        if (err) {
          try {
            logger.info(`Error in getLocation: ${err}`);
          } catch (ex) {
            logger.info(`try catch error: ${ex}`);
          }
          return getLocationOld(cb);
        }
        logger.info(`data in getLocation: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
        return parseResponse(data, cb);
      });
    } else {
      logger.info('Not yet supported');
      return cb(new Error('Not yet supported'));
    }
  });
};

const askLocationNativePermission = (cb) => {
  logger.info('Asking for location permission');
  socket.writeMessage(nameArray[0], (err, data) => {
    try {
      logger.info(`Error: ${err}`);
    } catch (ex) {
      logger.info(`try catch error in askLocationNativePermission: ${ex}`);
    }
    if (err) return cb(err);
    logger.info(`data in askLocationNativePermission: ${typeof data === 'object' ? JSON.stringify(data) : data}`);
    return cb(null, data);
  }, 31000);
};

exports.get_location = getLocation;
exports.askLocationNativePermission = askLocationNativePermission;
