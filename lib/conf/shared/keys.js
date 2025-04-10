/* eslint-disable consistent-return */
const fs = require('fs');
const log = require('./log');
const config = require('../../utils/configfile');
const panel = require('./panel');

/// /////////////////////////////////////
// getters

// returns false if api is empty
exports.is_api_key_set = () => {
  const keys = this.get();
  return keys.api && keys.api.toString().trim() !== '';
};

exports.get = () => {
  const keys = {
    api: config.getData('control-panel.api_key'),
    device: config.getData('control-panel.device_key'),
  };
  return keys;
};

exports.del = () => {
  config.update('control-panel.api_key', '');
  config.update('control-panel.device_key', '');
};

/// /////////////////////////////////////
// setters
exports.set = (keys, cb) => {
  if (keys.api && keys.api.toString().trim() === '') { return cb(new Error('Trying to set empty API Key!')); }

  if (keys.api) { config.setData('control-panel.api_key', keys.api); }

  if (typeof keys.device !== 'undefined') { config.setData('control-panel.device_key', keys.device); }
  cb();
  // config.save(cb);
};

exports.set_api_key = (key, cb) => {
  // if api key is changed, make sure device key is cleared
  // to avoid bad things from happenning
  this.set({ api: key, device: '' }, cb);
};

exports.set_device_key = (key, cb) => {
  this.set({ device: key }, cb);
};

exports.set_api_device_key = (key, cb) => {
  this.set({ api: key.api, device: key.device }, cb);
};

/// /////////////////////////////////////
// checkers

exports.verify_current = (cb) => {
  config.load(() => {
    const keys = this.get();

    if (!keys.api) return cb(new Error('API Key not found!'));
    if (!keys.device) return cb(new Error('Device Key not found! Run `bin/prey` to get your device linked.'));

    panel.verify_keys(keys, cb);
  });
};

exports.retrieve_old_keys = (file, cb) => {
  log(`Reading config keys from file: ${file}`);

  fs.readFile(file, (err, data) => {
    if (err) {
      log(err.message);
      return cb(err);
    }

    const str = data.toString();
    const apiKey = str.match(/api_key=([^\n]*)/);
    const devKey = str.match(/device_key=([^\n]*)/);

    if (!apiKey[1] || apiKey[1].trim() === '') { return cb(new Error(`No keys found in file: ${file}`)); }

    const keys = {
      api: apiKey[1].replace(/'/g, ''),
      device: devKey[1] && devKey[1].replace(/'/g, ''),
    };

    panel.verify_keys(keys, (errKeys) => {
      if (errKeys) return cb(errKeys);

      exports.set(keys, cb);
    });
  });
};
