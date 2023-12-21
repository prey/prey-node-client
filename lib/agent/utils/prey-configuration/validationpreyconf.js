const {
  verifyExistingData,
  getDataDb,
  correctPreyConf,
  trySaveData,
  saveDataToDb,
  startVerifyPreyConf,
  verifyPreyConfData,
  correctDeviceKeyConf,
} = require('./preyconf');
const keys = require('../../control-panel/api/keys');
const common = require('../../common');

const logger = common.logger.prefix('VALIDATIONPREYCONF');
const storage = require('../storage');

let dbPreyConfInterval;

const saveDataDbPreyConfRestart = (stored, callback) => {
  try {
    if (stored && stored.length > 0) {
      storage.do('update', {
        type: 'keys', id: 'restarts_preyconf', columns: 'value', values: parseInt(stored, 10).toString(),
        // eslint-disable-next-line consistent-return
      }, (errUpdate) => {
        if (errUpdate) {
          logger.error(`Error while updating restarts_preyconf: ${errUpdate}`);
          return callback(errUpdate, null);
        }
        callback(null, (parseInt(stored[0].value, 10) + 1));
      });
    } else {
      storage.do('set', { type: 'keys', id: 'restarts_preyconf', data: { value: parseInt(stored, 10).toString() } }, (errSetting) => {
        if (errSetting) {
          logger.error(`Error while setting restarts_preyconf: ${errSetting}`);
          return callback(errSetting, null);
        }
        return callback(null, 1);
      });
    }
  } catch (e) {
    logger.error(`Error getPreyConf: ${e}`);
  }
};
// eslint-disable-next-line consistent-return
const getRestartsPreyconf = (callback) => {
  try {
    // eslint-disable-next-line consistent-return
    getDataDb('restarts_preyconf', (err, stored) => {
      if (err) {
        logger.error(`Error while querying db for restarts_preyconf: ${err}`);
        return callback(err, null);
      }
      if (stored && stored.length > 0) {
        storage.do('update', {
          type: 'keys', id: 'restarts_preyconf', columns: 'value', values: (parseInt(stored[0].value, 10) + 1).toString(),
          // eslint-disable-next-line consistent-return
        }, (errUpdate) => {
          if (errUpdate) {
            logger.error(`Error while updating restarts_preyconf: ${errUpdate}`);
            return callback(errUpdate, null);
          }
          callback(null, (parseInt(stored[0].value, 10) + 1));
        });
      } else {
        storage.do('set', { type: 'keys', id: 'restarts_preyconf', data: { value: '1' } }, (errSetting) => {
          if (errSetting) {
            logger.error(`Error while setting restarts_preyconf: ${errSetting}`);
            return callback(errSetting, null);
          }
          return callback(null, 1);
        });
      }
    });
  } catch (e) {
    logger.error(`Error getRestartsPreyconf: ${e}`);
    return callback(null, 1);
  }
};

const processExitCall = () => {
  setTimeout(() => {
    process.exit(0);
  }, 5000);
};
const correctPreyConfCallback = (callback) => {
  // eslint-disable-next-line consistent-return
  getDataDb('preyconf', (err, data) => {
    if (err || !data) {
      return callback();
    }

    // eslint-disable-next-line no-prototype-builtins
    if (data.length === 0 || (typeof (data[0]) === 'object' && !data[0].hasOwnProperty('value'))) return callback();
    const jsonData = JSON.parse(data[0].value);
    // eslint-disable-next-line consistent-return
    verifyExistingData(jsonData, data, (verified) => {
      if (verified) return callback();
      // eslint-disable-next-line consistent-return
      correctPreyConf(jsonData, (errorCorrectPreyConf) => {
        if (errorCorrectPreyConf) return callback();
        // eslint-disable-next-line consistent-return
        getRestartsPreyconf((errRestartPreyConf, dataRestart) => {
          if (errRestartPreyConf || !dataRestart) {
            return callback();
          }
          if (dataRestart < 2) {
            return processExitCall();
          }
          callback();
        });
      });
    });
  });
};

const AllLooksGoods = (cb) => {
  logger.info('Everything looks good with PreyConf!');
  cb();
};

const clearIntervalDbPreyConf = () => {
  if (dbPreyConfInterval) clearInterval(dbPreyConfInterval);
};

const verifyApiDeviceKey = (cb) => {
  const api = common.config.get('control-panel.api_key');
  const device = common.config.get('control-panel.device_key');
  // eslint-disable-next-line consistent-return
  keys.verify({ api, device }, (err) => {
    if (err) return cb(err);
    cb(null);
  });
};

const saveDataVerify = () => {
  verifyApiDeviceKey((err) => {
    if (err) return;
    const triedSaveDataInterval = trySaveData();
    if (triedSaveDataInterval != null) saveDataToDb(triedSaveDataInterval);
  });
};

const setIntervalDbPreyConf = () => setInterval(() => {
  saveDataVerify();
}, 60 * 60 * 1000);

const runVerificationPreyConfiguration = (callback) => {
  try {
    clearIntervalDbPreyConf();
    saveDataVerify();
    dbPreyConfInterval = setIntervalDbPreyConf();
    const verifiedPreyConf = startVerifyPreyConf();
    if (verifiedPreyConf.constitution === false) {
      logger.info('There is an error on Preyconf, Repairing!');
      correctPreyConfCallback(callback);
    } else if (verifiedPreyConf.apiKeyValue && !verifiedPreyConf.deviceKeyValue) {
      correctDeviceKeyConf((errCorrectDeviceKey) => {
        if (errCorrectDeviceKey) logger.warn(`there was an error: ${JSON.stringify(errCorrectDeviceKey)}`);
        callback();
      });
    } else if (verifiedPreyConf.constitution) {
      try {
        const verifiedPreyConfData = verifyPreyConfData();
        if (verifiedPreyConfData === true) {
          AllLooksGoods(callback);
        } else {
          correctPreyConfCallback(callback);
        }
      } catch (errorVerifiedPreyConfData) {
        logger.warn(`there was an error: ${JSON.stringify(errorVerifiedPreyConfData)}`);
        callback();
      }
    } else {
      AllLooksGoods(callback);
    }
  } catch (errorVerifyingPreyConf) {
    logger.warn(`there was an error: ${JSON.stringify(errorVerifyingPreyConf)}`);
    callback();
  }
};

exports.saveDataDbPreyConfRestart = saveDataDbPreyConfRestart;
exports.clearIntervalDbPreyConf = clearIntervalDbPreyConf;
exports.correctPreyConfCallback = correctPreyConfCallback;
exports.setIntervalDbPreyConf = setIntervalDbPreyConf;
exports.runVerificationPreyConfiguration = runVerificationPreyConfiguration;
