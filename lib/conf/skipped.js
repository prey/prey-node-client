const common = require('../common');
const shared = require('./shared');
const skippedPermissions = require('./../utils/skippedPermissions')

const update = (key, val, cb) => {
  if (!key) { return cb(new Error('Key required.')); }

  const current = skippedPermissions.getData(key);
  if (val === null || val === undefined || (val != 'true' && val != 'false')) {
    return cb(new Error(`Please provide a valid value for ${key}. Current is \`${current}\``)); 
  } 

  if (typeof current === 'undefined') { return cb(new Error(`Key not found in config: ${key}`)); }
  skippedPermissions.update(key, val, cb);
};

const log = function (str) {
  shared.log(str);
};

exports.list = function (values, cb) {
  if (common.os_name != "mac") return log("Command only available for macOS");
  const dataFromDb = skippedPermissions.all();
  log(dataFromDb);
};

exports.read = function (values, cb) {
  if (common.os_name != "mac") return log("Command only available for macOS");
  if (!values.key) { return cb(new Error('Key required.')); }
  const data = skippedPermissions.getData(values.key);
  if (typeof data === 'undefined') { return cb(new Error(`${values.key} not found.`)); }
  if (data === null) return log(`${values.key} value is null.`);
  log(data);
};

exports.update = function (values, cb) {
  if (common.os_name != "mac") return log("Command only available for macOS");
  const key = values.positional[0];
  const val = values.positional[1];

  update(key, val, cb);
};