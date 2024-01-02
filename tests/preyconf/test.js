const fs = require('fs');
const { join } = require('path');
const { forEach } = require('underscore');
const { reqPreyConf } = require('../../lib/agent/utils/prey-configuration/util-preyconf');

const getFileContent = (path) => {
  let allFileContents = '';
  try {
    allFileContents = fs.readFileSync(path, 'utf-8');
  } catch (errorRead) {
    throw new Error('errorcito');
  }
  return allFileContents;
};

const readWithoutVerification = (path) => {
  const extractedData = {};
  let nameBefore = '';
  let content = '';
  try {
    content = getFileContent(path);
    if (content === '') {
      throw new Error(`error reading ${path}`);
    }
  } catch (error) {
    return error;
  }
  const allNames = reqPreyConf.filter((element) => element.name !== 'control-panel');
  const allToSaved = reqPreyConf.map((word) => word.toSave);
  const allToSave = allToSaved.filter((word) => {
    if (word) return true;
  });
  try {
    content.toString().split(/\r?\n/).forEach((line) => {
      // eslint-disable-next-line array-callback-return, consistent-return
      const containsElement = reqPreyConf.filter((item) => item.regex.test(line));
      if (containsElement.length > 0) {
        if (containsElement[0].word === 'control-panel') nameBefore = 'control-panel.';
        const data = allToSave.filter((item) => item.test(line));
        if (data && data.length > 0) {
          const match = (/(.+) = (.+)/).exec(line);
          const dataName = `${nameBefore}${match[1]}`;
          const filteredReqPreyConf = reqPreyConf.filter(
            (element) => element.name.localeCompare(dataName) === 0,
          );
          if (!filteredReqPreyConf[0].possiblevalues.test(match[2])) {
            extractedData[`${dataName}`] = filteredReqPreyConf[0].default;
          } else {
            // eslint-disable-next-line prefer-destructuring
            extractedData[`${dataName}`] = match[2];
          }
        }
      }
    });
  } catch (error) {
    console.log(error);
    return error;
  }
  allNames.forEach((element) => {
    if (!extractedData[element.name]) {
      extractedData[element.name] = element.default;
    }
  });
  console.log(extractedData);
};

console.log('[TEST] prey_apikey_devicekey');
let pathToConf = join(__dirname, 'tests', 'preyconf', 'utils', 'prey_apikey_devicekey.conf');
readWithoutVerification(pathToConf);

console.log('[TEST] prey_apikey_nodevicekey');
pathToConf = join(__dirname, 'tests', 'preyconf', 'utils', 'prey_apikey_nodevicekey.conf');
readWithoutVerification(pathToConf);

console.log('[TEST] prey_bad_format');
pathToConf = join(__dirname, 'tests', 'preyconf', 'utils', 'prey_bad_format.conf');
readWithoutVerification(pathToConf);

console.log('[TEST] prey_default');
pathToConf = join(__dirname, 'tests', 'preyconf', 'utils', 'prey_default.conf');
readWithoutVerification(pathToConf);

console.log('[TEST] prey_noapikey_devicekey');
pathToConf = join(__dirname, 'tests', 'preyconf', 'utils', 'prey_noapikey_devicekey.conf');
readWithoutVerification(pathToConf);

console.log('[TEST] prey_noformat');
pathToConf = join(__dirname, 'tests', 'preyconf', 'utils', 'prey_noformat.conf');
readWithoutVerification(pathToConf);

console.log('[TEST] prey_nohost');
pathToConf = join(__dirname, 'tests', 'preyconf', 'utils', 'prey_nohost.conf');
readWithoutVerification(pathToConf);

console.log('[TEST] prey_noprotocol');
pathToConf = join(__dirname, 'tests', 'preyconf', 'utils', 'prey_noprotocol.conf');
readWithoutVerification(pathToConf);
