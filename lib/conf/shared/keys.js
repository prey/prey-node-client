const fs = require('fs');
const log = require('./log');
const { config } = require('../../common');
const panel = require('./panel');

///
// getters

// returns false if api is empty
exports.isApiKeySet = () => {
  const keys = this.get();
  return keys.api && keys.api.toString().trim() !== '';
};

exports.get = () => ({
  api: config.get('control-panel.api_key'),
  device: config.get('control-panel.device_key'),
});

exports.del = () => {
  config.update('control-panel.api_key', '');
  config.update('control-panel.device_key', '');
};

/// /////////////////////////////////////
// setters

exports.set = (keys, cb) => {
  if (keys.api && keys.api.toString().trim() === '') {
    return cb(new Error('Trying to set empty API Key!'));
  }

  if (keys.api) {
    config.set('control-panel.api_key', keys.api);
  }

  if (typeof keys.device !== 'undefined') {
    config.set('control-panel.device_key', keys.device);
  }

  config.save(cb);
};

exports.setApiKey = (key, cb) => {
  // if api key is changed, make sure device key is cleared
  // to avoid bad things from happenning
  this.set({ api: key, device: '' }, cb);
};

exports.setDeviceKey = (key, cb) => {
  this.set({ device: key }, cb);
};

/// /////////////////////////////////////
// checkers

exports.verify_current = (cb) => {
  const keys = this.get();

  if (!keys.api) {
    return cb(new Error('API Key not found!'));
  }

  if (!keys.device) {
    return cb(
      new Error(
        'Device Key not found! Run `bin/prey` to get your device linked.'
      )
    );
  }

  panel.verify_keys(keys, cb);
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

    if (!apiKey[1] || apiKey[1].trim() === '')
      return cb(new Error(`No keys found in file: ${file}`));

    const keys = {
      api: apiKey[1].replace(/'/g, ''),
      device: devKey[1] && devKey[1].replace(/'/g, ''),
    };

    panel.verify_keys(keys, (childErr) => {
      if (childErr) {
        return cb(childErr);
      }

      exports.set(keys, cb);
    });
  });
};
