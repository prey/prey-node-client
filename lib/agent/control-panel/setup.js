/* eslint-disable consistent-return */
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

const getDeviceData = (callback) => {
  logger.info('Gathering device data...');
  let e;
  let count = 3;
  const data = {};

  const done = (err, newData) => {
    if (err) {
      e = err;
    } else {
      Object.keys(newData).forEach((key) => {
        data[key] = newData[key];
      });
    }
    // eslint-disable-next-line no-unused-expressions, no-plusplus
    --count || callback(e, data);
  };

  providers.get('specs', (err, dataGetSpecs) => {
    done(err, { specs: dataGetSpecs });
  });

  agent.system.get_os_name((err, name) => {
    done(err, { os: name });
  });

  agent.system.get_os_version((err, ver) => {
    done(err, { os_version: ver });
  });
};

const linkDevice = (cb) => {
  getDeviceData((err, deviceData) => {
    const data = deviceData;
    if (err) return cb(err);

    data.name = agent.system.get_device_name();
    data.device_type = (data.specs.firmware_info && data.specs.firmware_info.device_type) || 'Laptop';
    data.model_name = (data.specs.firmware_info && data.specs.firmware_info.model_name) || '';
    data.vendor_name = (data.specs.firmware_info && data.specs.firmware_info.vendor_name) || '';

    api.devices.link(data, (errLinking, key) => {
      if (errLinking || !key) { return cb(errLinking || new Error('Something happened. Could not register.')); }

      secure.notify_linked(data);
      logger.warn(`Device succesfully linked. Key: ${key}`);
      config.setData('control-panel.device_key', key, cb);
    });
  });
};

// get OS version and real name and add it to the user agent
const setup_api = (cb) => { // TODO: check this fn an make it better and remove unused vars
  agent.system.get_os_info((err, data) => {
    const os_info = err ? agent.system.os_name : [data.name, data.version].join(' ');

    api.use({
      logger: agent.logger,
    });

    // eslint-disable-next-line no-unused-expressions
    cb && cb();
  });
};

const setupKeys = (cb) => {
  const data = config.all();
  const keys = {
    api: data['control-panel.api_key'],
    device: data['control-panel.device_key'],
  };
  const done = (err) => {
    config.setData('api_key', '');
    config.setData('device_key', '');
    cb(err, keys);
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

exports.start = (common, cb) => {
  if (running) return cb(new Error('Setup in progress.'));

  const done = (err) => {
    running = false;
    cb(err);
  };

  running = true;
  agent = common;
  logger = common.logger;

  // check existing or keys from previous config file.
  setupKeys((err, keys) => {
    if (err) return done(err);

    setup_api(() => {
      api.keys.set(keys, (errSetup) => {
        // if api is empty or both are present, stop here.
        if (errSetup || api.keys.present()) { return done(errSetup); }

        linkDevice((errLink) => {
          if (errLink) logger.error(`Unable to register device: ${errLink.message}`);
          done(errLink);
        });
      });
    });
  });
};
