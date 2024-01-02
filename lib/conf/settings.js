const common = require('../common');
const shared = require('./shared');
const config = require('../utils/configfile');
const { verifyPreyConfData, readWithoutVerification } = require('../agent/utils/prey-configuration/preyconf');

const log = function (str) {
  shared.log(str);
};

const no_config = function () {
  return new Error('Config file not found! Run `config activate` to build one.');
};

const update = function (key, val, cb) {
  if (!key) { return cb(new Error('Key required.')); }

  const current = config.getData(key);

  if (!val) { return cb(new Error(`Please provide a value for ${key}. Current is \`${current}\``)); }

  if (typeof current === 'undefined') { return cb(new Error(`Key not found in config: ${key}`)); }

  if (typeof current === 'object') { return cb(new Error(`${key} is an object. Valid subkeys are: ${Object.keys(current).join(', ')}`)); }

  config.update(key, val, cb);
};

exports.list = function (values, cb) {
  config.all((dataFromDb) => {
    log(dataFromDb);
  });
};

exports.read = function (values, cb) {
  if (!values.key) { return cb(new Error('Key required.')); }

  const val = config.getData(values.key);
  if (typeof val === 'undefined') { return cb(new Error(`${values.key} not found.`)); }

  log(val);
};

exports.update = function (values, cb) {
  const key = values.positional[0];
  const val = values.positional[1];

  update(key, val, cb); // does all the checks for us.
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

exports.fromFile = (cb) => {
  const dataVerifiedFromFile = verifyPreyConfData(false);
  console.log(dataVerifiedFromFile);
  if (dataVerifiedFromFile === true) {
    // eslint-disable-next-line consistent-return
    readWithoutVerification((errReadWithoutVerification, data) => {
      if (errReadWithoutVerification) return cb(errReadWithoutVerification);
      log('everything ok');
      config.setFullFromData(data, (err) => {
        if (err) return log(`There was an error while setting the config: ${err}`);
        return log('everything ok');
      });
    });
  } else if (dataVerifiedFromFile instanceof Error) {
    return log(`There was an error while setting the config: ${dataVerifiedFromFile}`);
  } else {
    const listPropertyNames = Object.keys(dataVerifiedFromFile);
    return log(`Invalid prey configuration in the following properties:\n${listPropertyNames.join(',\n')}`);
  }
};
