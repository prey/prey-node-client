const fs = require('fs');
const { join } = require('path');
const config = require('../../../utils/configfile');
const configPath = require('../../../common').system.paths.config;
const logger = require('../../common').logger.prefix('preyconf');
const storage = require('../storage');
const account = require('../../../conf/account');
const { reqPreyConf } = require('./util-preyconf');

const breakException = {};
const errorReading = new Error('Error reading prey.conf');
let apiKeyValue = false;
let deviceKeyValue = false;

exports.preyConfPath = join(configPath, 'prey.conf');
const getFileContent = (path) => {
  let allFileContents = '';
  try {
    allFileContents = fs.readFileSync(path, 'utf-8');
  } catch (errorRead) {
    throw errorReading;
  }
  return allFileContents;
};

const resetDefaultValues = () => {
  apiKeyValue = false;
  deviceKeyValue = false;
};

const verifyPreyConf = () => {
  resetDefaultValues();
  let allFileContents = '';
  try {
    allFileContents = getFileContent(exports.preyConfPath);
    if (allFileContents === '') {
      throw breakException;
    }
  } catch (error) {
    return error;
  }
  let count = 0;
  let countFound = 0;
  // eslint-disable-next-line consistent-return
  allFileContents.split(/\r?\n/).forEach((line) => {
    if (count <= reqPreyConf.length - 1) {
      if (line.includes(reqPreyConf[count].word)) {
        if (line.match(reqPreyConf[count].regex)) {
          if (reqPreyConf[count].value) {
            if (line.match(reqPreyConf[count].value)) {
              if (reqPreyConf[count].word === 'api_key') {
                apiKeyValue = true;
              } else if (reqPreyConf[count].word === 'device_key') {
                deviceKeyValue = true;
              }
            }
          }
          countFound += 1;
        } else {
          throw breakException;
        }
        count += 1;
      }
    }
  });

  return countFound === reqPreyConf.length;
};

const verifyPreyConfData = (doNotVerifyApiDeviceKey = false) => {
  const dataToFix = {};
  let somethingWrong = false;
  resetDefaultValues();
  let content = '';
  try {
    content = getFileContent(exports.preyConfPath);
    if (content === '') {
      throw breakException;
    }
  } catch (error) {
    return error;
  }
  let count = 0;
  let countFound = 0;

  // eslint-disable-next-line consistent-return
  try {
    content.toString().split(/\r?\n/).forEach((line) => {
      if (count <= reqPreyConf.length - 1) {
        if (line.includes(reqPreyConf[count].word)) {
          if (reqPreyConf[count].regex.test(line)) {
            if ((!doNotVerifyApiDeviceKey || reqPreyConf[count].word !== 'api_key') && (!doNotVerifyApiDeviceKey || reqPreyConf[count].word !== 'device_key')) {
              if (reqPreyConf[count].value) {
                if (!reqPreyConf[count].value.test(line)) {
                  somethingWrong = true;
                  dataToFix[reqPreyConf[count].name] = false;
                }
                const match = reqPreyConf[count].toSave.exec(line);
                if (match && !reqPreyConf[count].possiblevalues.test(match[1])) {
                  somethingWrong = true;
                  dataToFix[reqPreyConf[count].name] = false;
                }
              }
            }
            countFound += 1;
          } else {
            somethingWrong = true;
          }
          count += 1;
        }
      }
    });
  } catch (error) {
    return error;
  }
  if (somethingWrong) return dataToFix;
  return countFound === reqPreyConf.length;
};

// eslint-disable-next-line consistent-return
const verifyExistingData = (dataToVerify, dataFromDb, callback) => {
  if (!dataToVerify || !dataFromDb
  || (typeof dataToVerify) !== 'object' || (typeof dataFromDb) !== 'object'
  || Object.keys(dataToVerify).length === 0
  || Object.keys(dataFromDb).length === 0) { return callback(false); }
  let verified = true;
  // eslint-disable-next-line consistent-return
  Object.keys(dataToVerify).forEach((key) => {
    // eslint-disable-next-line no-prototype-builtins
    if (!dataFromDb.hasOwnProperty(key)) {
      verified = false;
    }
  });
  return callback(verified);
};

const dataToSavePreyConf = () => {
  let allFileContents = '';
  try {
    allFileContents = getFileContent(exports.preyConfPath);
    if (allFileContents === '') {
      throw breakException;
    }
  } catch (error) {
    return error;
  }
  const preyConfData = {};
  let count = 0;
  // eslint-disable-next-line consistent-return
  allFileContents.split(/\r?\n/).forEach((line) => {
    if (count <= reqPreyConf.length - 1) {
      if (line.includes(reqPreyConf[count].word)) {
        if (line.match(reqPreyConf[count].regex)) {
          if (reqPreyConf[count].toSave) {
            const match = reqPreyConf[count].toSave.exec(line);
            if (match) {
              const value = match[1];
              const matchValue = reqPreyConf[count].possiblevalues.exec(value);
              if (matchValue) {
                preyConfData[reqPreyConf[count].name] = value;
              } else if (reqPreyConf[count].default) {
                // eslint-disable-next-line max-len
                preyConfData[reqPreyConf[count].name] = reqPreyConf[count].default;
              }
            }
          }
        } else {
          throw breakException;
        }
        count += 1;
      }
    }
  });
  return preyConfData;
};

// eslint-disable-next-line consistent-return
const correctPreyConf = (preyConfDataToWrite, callback) => {
  let allFileContents = '';

  allFileContents = getFileContent(join(__dirname, '../../../../prey.conf.default'));
  if (allFileContents === '') {
    throw breakException;
  }
  let count = 0;
  let stringToWrite = '';
  // eslint-disable-next-line consistent-return
  allFileContents.split(/\r?\n/).forEach((line) => {
    if (count <= reqPreyConf.length - 1) {
      if (line.includes(reqPreyConf[count].word)) {
        if (RegExp(reqPreyConf[count].regex).exec(line)) {
          if (reqPreyConf[count].regex.toString().includes('=')) {
            const regex = /\//g;
            const regexWithoutForwardSlash = reqPreyConf[count].regex.toString().replace(regex, '');
            let dataToInsert = '';
            if (preyConfDataToWrite) {
              dataToInsert = preyConfDataToWrite[reqPreyConf[count].name] ? preyConfDataToWrite[reqPreyConf[count].name] : '';
            } else {
              dataToInsert = reqPreyConf[count].default
              || ((typeof reqPreyConf[count].default === 'boolean') && reqPreyConf[count].default === false) ? reqPreyConf[count].default : '';
            }
            stringToWrite += `${regexWithoutForwardSlash} ${dataToInsert}\n`;
          } else {
            stringToWrite += `${line}\n`;
          }
        } else {
          throw breakException;
        }
        count += 1;
      } else {
        stringToWrite += `${line}\n`;
      }
    }
  });
  try {
    fs.writeFileSync(exports.preyConfPath, stringToWrite);
    callback(null);
  } catch (errorWrite) {
    logger.info(`ERROR ${errorWrite}`);
    callback(errorWrite);
  }
};

const correctDeviceKeyConf = (callback) => {
  const apiKey = config.get('control-panel.api_key').toString();
  account.authorize({ '-a': apiKey }, (err) => {
    if (err) {
      logger.error(`Error while authorize: ${err}`);
    }
    callback(err);
  });
};

const getDataDb = (whatToGet, callback) => {
  try {
    storage.do('query', { type: 'keys', column: 'id', data: whatToGet }, (err, stored) => {
      if (err) {
        return callback(err, null);
      }
      if (stored && stored.length > 0) {
        return callback(null, stored);
      }
      return callback(null, null);
    });
  } catch (e) {
    logger.error(`Error getDataDb: ${e}`);
  }
};

// eslint-disable-next-line consistent-return
const saveDataToDb = (dataToSave, cb) => {
  try {
    // eslint-disable-next-line consistent-return
    getDataDb('preyconf', (err, stored) => {
      if (err) {
        logger.error(`Error while querying db for preyconf: ${err}`);
        return cb(err);
      }
      if (stored && stored.length > 0) {
        storage.do('update', {
          type: 'keys', id: 'preyconf', columns: 'value', values: JSON.stringify(dataToSave),
        }, (errUpdate) => {
          if (errUpdate) {
            logger.error(`Error while updating preyconf: ${errUpdate}`);
            return cb(errUpdate);
          }
          return cb();
        });
      } else {
        storage.do('set', { type: 'keys', id: 'preyconf', data: { value: JSON.stringify(dataToSave) } }, (errSetting) => {
          if (errSetting) {
            logger.error(`Error while setting preyconf: ${errSetting}`);
            return cb(errSetting);
          }
          return cb();
        });
      }
    });
  } catch (e) {
    logger.error(`Error saveDataToDb: ${e}`);
    return cb(e);
  }
};

const startVerifyPreyConf = () => {
  try {
    return { constitution: verifyPreyConf(), apiKeyValue, deviceKeyValue };
  } catch (e) {
    return { constitution: false, apiKeyValue, deviceKeyValue };
  }
};
const trySaveData = () => {
  try {
    const verifiedData = verifyPreyConfData();
    if (verifiedData === true) {
      return dataToSavePreyConf();
    }
    return null;
  } catch (e) {
    return null;
  }
};

exports.verifyExistingData = verifyExistingData;
exports.startVerifyPreyConf = startVerifyPreyConf;
exports.saveDataToDb = saveDataToDb;
exports.correctDeviceKeyConf = correctDeviceKeyConf;
exports.correctPreyConf = correctPreyConf;
exports.dataToSavePreyConf = dataToSavePreyConf;
exports.verifyPreyConf = verifyPreyConf;
exports.trySaveData = trySaveData;
exports.getDataDb = getDataDb;
exports.verifyPreyConfData = verifyPreyConfData;
