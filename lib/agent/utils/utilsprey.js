// eslint-disable-next-line consistent-return
const isBoolean = (type) => {
  if (typeof type === 'string') {
    const resp = type.trim().toLowerCase();
    return resp === 'true';
  }
  if (typeof type === 'number' && type !== 1 && type !== 0) return false;
  return Boolean(type);
};

const stringBooleanOrEmpty = (str) => {
  // eslint-disable-next-line no-constant-condition
  if (!str && str !== false) return '';
  const stringStr = str.toString();
  if (stringStr.localeCompare('Allow') === 0) return 'true';
  if (stringStr.localeCompare('Deny') === 0) return 'false';
  if (/^(true|false)$/.test(stringStr)) return stringStr;
  return '';
};

const splitGfromString = (str) => {
  const separatedG = str.split('g');
  if (separatedG.length > 1) {
    const regex = /-?\d+/g;
    const matches = separatedG[1].match(regex);
    if (!matches) return str;
    return matches[0];
  }
  return str;
};

const getChannelDifFormat = (str) => {
  let dataSeparator = '';
  const splittedStr = str.split('(');
  if (splittedStr.length > 1) {
    const trimmedStr = splittedStr[0].trim();
    dataSeparator = trimmedStr;
  }
  if (dataSeparator.localeCompare('') !== 0) {
    return splitGfromString(dataSeparator);
  }
  return splitGfromString(str);
};

const getInformationChannel = (str) => {
  const regex = /\d+(?= \(.*\))/;
  const match = str.match(regex);
  const number = match ? match[0] : '';
  if (number.localeCompare('') === 0) {
    return getChannelDifFormat(str);
  }
  return number;
};

const removeBackslash = (str) => {
  let stringData = str;
  if (typeof stringData === 'object') stringData = JSON.stringify(stringData);
  return stringData.replace(/\\/g, '');
};

exports.getChannelDifFormat = getChannelDifFormat;
exports.getInformationChannel = getInformationChannel;
exports.isBoolean = isBoolean;
exports.stringBooleanOrEmpty = stringBooleanOrEmpty;
exports.removeBackslash = removeBackslash;
exports.splitGfromString = splitGfromString;
