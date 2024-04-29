const path = require('path');
const dotenv = require('dotenv');

const dotEnvPath = path.join(__dirname, '../../../.env');
dotenv.config({ path: dotEnvPath });
const environment = process.env;

const isString = (key) => {
  let isOk = true;
  if (typeof key !== 'string') {
    isOk = false;
    throw new Error('the key received isn\'t an valid string');
  }
  return isOk;
};

const fetchEnvVar = (key2find) => {
  let keyFound;
  try {
    if (isString(key2find) && environment[`${key2find}`]) {
      keyFound = environment[`${key2find}`];
    } else if (isString(key2find) && key2find === 'all') {
      keyFound = environment;
    }
  } catch (error) {
    return error;
  }
  return keyFound;
};

module.exports = fetchEnvVar;
