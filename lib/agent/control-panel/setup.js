const api = require('./api');
const secure = require('./secure');
const providers = require('../providers');

const config = require('../../utils/configfile');

let agent;
let running = false;
let logger = {};

['debug', 'info', 'warn', 'error'].forEach((k) => {
  logger[k] = console.log;
});

const link_device = function (cb) {
  get_device_data((err, data) => {
    if (err) return cb(err);

    data.name = agent.system.get_device_name();
    data.device_type = data.specs.firmware_info && data.specs.firmware_info.device_type || 'Laptop';
    data.model_name = data.specs.firmware_info && data.specs.firmware_info.model_name || '';
    data.vendor_name = data.specs.firmware_info && data.specs.firmware_info.vendor_name || '';

    api.devices.link(data, (err, key) => {
      if (err || !key) { return cb(err || new Error('Something happened. Could not register.')); }

      secure.notify_linked(data);
      logger.warn(`Device succesfully linked. Key: ${key}`);
      config.setData('control-panel.device_key', key, cb);
    });
  });
};

var get_device_data = function (callback) {
  logger.info('Gathering device data...');
  let e; const data = {}; let
    count = 3;

  const done = function (err, new_data) {
    if (err) {
      e = err;
    } else {
      for (const key in new_data) {
        data[key] = new_data[key];
      }
    }
    --count || callback(e, data);
  };

  providers.get('specs', (err, data) => {
    done(err, { specs: data });
  });

  agent.system.get_os_name((err, name) => {
    done(err, { os: name });
  });

  agent.system.get_os_version((err, ver) => {
    done(err, { os_version: ver });
  });
};

// get OS version and real name and add it to the user agent
const setup_api = function (cb) {
  agent.system.get_os_info((err, data) => {
    const os_info = err ? agent.system.os_name : [data.name, data.version].join(' ');

    api.use({
      logger: agent.logger,
    });

    cb && cb();
  });
};

const setup_keys = function (cb) {
  const data = config.all();
  const done = function (err) {
    config.setData('api_key', '');
    config.setData('device_key', '');
    cb(err, keys);
  };
  logger.info(`calling to the night?`);
  const keys = {
    api: data['control-panel.api_key'],
    device: data['control-panel.device_key'],
  };

  if (keys.api && keys.api.toString().trim() !== '') { return done(); }

  // ok, so not found. let's see if we have them from the previous configuration
  if (!config) { return done(new Error('No global keys found.')); }

  // if found, move keys to new placeholders, and save config.
  if (keys.api && keys.api.toString().trim() !== '') {
    config.setData('api_key', '');
    config.setData('device_key', '');
    config.setData('control-panel.api_key', keys.api);
    config.setData('control-panel.device_key', keys.device);

    return done();
  }

  done();
};

exports.start = function (common, cb) {
  if (running) return cb(new Error('Setup in progress.'));

  const done = function (err) {
    running = false;
    cb(err);
  };

  running = true;
  agent = common;
  logger = common.logger;

  // check existing or keys from previous config file.
  setup_keys((err, keys) => {
    if (err) return done(err);

    setup_api(() => {
      api.keys.set(keys, (err) => {
        // if api is empty or both are present, stop here.
        if (err || api.keys.present()) { return done(err); }

        link_device((err) => {
          if (err) logger.error(`Unable to register device: ${err.message}`);
          done(err);
        });
      });
    });
  });
};
