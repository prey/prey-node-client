const common = require('../common');
const shared = require('./shared');
const config = require('../utils/configfile');
const { verifyPreyConfData, readWithoutVerification } = require('../agent/utils/prey-configuration/preyconf');
const { reqPreyConf } = require('../agent/utils/prey-configuration/util-preyconf');
const { isBoolean } = require('../agent/utils/utilsprey');

const log = function (str) {
  shared.log(str);
};

const no_config = function () {
  return new Error('Config file not found! Run `config activate` to build one.');
};

const update = (key, val, cb) => {
  if (!key) { return cb(new Error('Key required.')); }

  const current = config.getData(key);
  if (val === null || val === undefined) { return cb(new Error(`Please provide a value for ${key}. Current is \`${current}\``)); }

  if (typeof current === 'undefined') { return cb(new Error(`Key not found in config: ${key}`)); }
  const dataFromName = reqPreyConf.filter((item) => item.name === key);
  if (dataFromName) {
    if (!dataFromName[0].possiblevalues.test(val)) {
      return cb(new Error(`${val} is not an acceptable value for key: ${key}`));
    }
  }
  config.update(key, val, cb);
};

exports.list = function (values, cb) {
  const dataFromDb = config.all();
  log(dataFromDb);
};

exports.read = function (values, cb) {
  if (!values.key) { return cb(new Error('Key required.')); }
  const data = config.getData(values.key);
  if (typeof data === 'undefined') { return cb(new Error(`${values.key} not found.`)); }
  if (data === null) return log(`${values.key} value is null.`);
  log(data);
};

exports.update = function (values, cb) {
  const key = values.positional[0];
  const val = values.positional[1];
  const dataFromName = reqPreyConf.filter((item) => item.name === key);
  const dataToSave = (val.toLowerCase() === 'true' || val.toLowerCase() === 'false') ? isBoolean(val) : val;
  if (dataFromName) {
    if (!dataFromName[0].possiblevalues.test(dataToSave)) {
      return cb(new Error(`${dataToSave} is not an acceptable value for key: ${key}`));
    }
  }
  update(key, dataToSave, cb); // does all the checks for us.
};

exports.toggle = function (values, cb) {
  if (!values.key) return cb(new Error('Key required.'));
  const { key } = values;
  const current = config.getData(key);
  if (typeof current === 'undefined') return cb(new Error(`${key} not found.`));
  if (typeof current !== 'boolean') return cb(new Error(`${key} is not boolean.`));
  config.update(key, !current, (err) => {
    cb(err, `${key} toggled: ${current.toString()} -> ${(!current).toString()}`);
  });
};

exports.setEmpty = function (values, cb) {
  const { key } = values;
  if (key === 'control-panel') return cb(new Error(`${key} is not able to be empty.`));
  const expReg = /.*/;
  const dataFromName = reqPreyConf.filter((item) => item.name === key);
  if (dataFromName && dataFromName.length > 0) {
    if (dataFromName[0].possiblevalues.toString() !== expReg.toString()) {
      return cb(new Error(`${key} is not able to be empty.`));
    }
  } else {
    return cb(new Error(`There is no such key: ${key}.`));
  }
  config.update(key, null, (err) => {
    cb(err, `${key} set to empty.`);
  });
};

exports.fromFile = (cb) => {
  const dataVerifiedFromFile = verifyPreyConfData(false);
  if (dataVerifiedFromFile === true) {
    // eslint-disable-next-line consistent-return
    readWithoutVerification((errReadWithoutVerification, data) => {
      if (errReadWithoutVerification) return cb(errReadWithoutVerification);
      config.setFullFromData(data, (err) => {
        if (err) return log(`There was an error while setting the config: ${err}`);
        return log('Data modified from prey.conf');
      });
    });
  } else if (dataVerifiedFromFile instanceof Error) {
    return log(`There was an error while setting the config: ${dataVerifiedFromFile}`);
  } else {
    const listPropertyNames = Object.keys(dataVerifiedFromFile);
    return log(`Invalid prey configuration in the following properties:\n${listPropertyNames.join(',\n')}`);
  }
};
