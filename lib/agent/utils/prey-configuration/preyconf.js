const fs = require('fs');
const { join } = require('path');

const { config } = require('../../../common');
const configPath = require('../../../common').system.paths.config;
const logger = require('../../common').logger.prefix('preyconf');
const storage = require('../storage');
const account = require('../../../conf/account');
const { reqPreyConf } = require('./util-preyconf');

const breakException = {};
const errorReading = new Error('Error reading prey.conf');
const errorWriting = new Error('Error writing prey.conf');
let apiKeyValue = false;
let deviceKeyValue = false;

exports.preyConfPath = join(configPath, 'prey.conf');
const getFileContent = (path) => {
  let allFileContents = '';
  try {
    allFileContents = fs.readFileSync(path, 'utf-8');
  } catch (errorRead) {
    return errorReading;
  }
  return allFileContents;
};

const resetDefaultValues = () => {
  apiKeyValue = false;
  deviceKeyValue = false;
};

const verifyPreyConf = () => {
  resetDefaultValues();
  const allFileContents = getFileContent(exports.preyConfPath);
  if (allFileContents === '') {
    throw breakException;
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
            } else {
              throw breakException;
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

const dataToSavePreyConf = () => {
  const allFileContents = getFileContent(exports.preyConfPath);
  if (allFileContents === '') {
    throw breakException;
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
const correctPreyConf = (preyConfDataToWrite) => {
  const allFileContents = getFileContent('../../../../prey.conf.default');
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
            const dataToInsert = preyConfDataToWrite[reqPreyConf[count].name] ? preyConfDataToWrite[reqPreyConf[count].name] : '';
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
  } catch (errorWrite) {
    return errorWriting;
  }
};

const correctDeviceKeyConf = () => {
  const apiKey = config.get('control-panel.api_key').toString();
  account.authorize({ '-a': apiKey }, (err) => {
    if (err) {
      logger.error(`Error while authorize: ${err}`);
    }
  });
};

const saveDataToDb = (dataToSave) => {
  try {
    storage.do('query', { type: 'keys', column: 'id', data: 'preyconf' }, (err, stored) => {
      if (err) {
        logger.error(`Error while querying db for preyconf: ${err}`);
      }
      if (stored && stored.length > 0) {
        storage.do('update', {
          type: 'keys', id: 'preyconf', columns: 'value', values: JSON.stringify(dataToSave),
        }, (errUpdate) => {
          logger.error(`Error while updating preyconf: ${errUpdate}`);
        });
      } else {
        storage.do('set', { type: 'keys', id: 'preyconf', data: { value: JSON.stringify(dataToSave) } }, (errSetting) => {
          logger.error(`Error while setting preyconf: ${errSetting}`);
        });
      }
    });
  } catch (e) {
    logger.error(`Error saveDataToDb: ${e}`);
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
    return dataToSavePreyConf();
  } catch (e) {
    return null;
  }
};

exports.startVerifyPreyConf = startVerifyPreyConf;
exports.saveDataToDb = saveDataToDb;
exports.correctDeviceKeyConf = correctDeviceKeyConf;
exports.correctPreyConf = correctPreyConf;
exports.dataToSavePreyConf = dataToSavePreyConf;
exports.verifyPreyConf = verifyPreyConf;
exports.trySaveData = trySaveData;
