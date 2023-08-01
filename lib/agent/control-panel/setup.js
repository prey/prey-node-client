const api = require('./api');
const secure = require('./secure');
const common = require('../../common');
const providers = require('../providers');
const system = require('../../system');

const { config } = common;
let agent;
let running = false;
let logger = {};

['debug', 'info', 'warn', 'error'].forEach((k) => {
  logger[k] = console.log;
});

const getDeviceData = (callback) => {
  logger.info('Gathering device data...');
  let error;
  let data = {};
  let count = 3;

  var done = (err, newData) => {
    if (err) {
      error = err;
    } else {
      for (var key in newData) {
        data[key] = newData[key];
      }
    }

    --count || callback(error, data);
  };

  providers.get('specs', (err, specs) => {
    done(err, { specs });
  });

  system.get_os_name((err, os) => {
    done(err, { os });
  });

  system.get_os_version((err, os_version) => {
    done(err, { os_version });
  });
};

const linkDevice = (cb) => {
  getDeviceData((err, data) => {
    let dataValues = {};
    if (err) {
      return cb(err);
    }
    dataValues = {...data}; // this seems to be the problem, since that new object
    // didnt have all the object attributes from data, so it was just a portion of it
    dataValues.name = system.get_device_name();
    dataValues.device_type =
      (data.specs.firmware_info && data.specs.firmware_info.device_type) ||
      'Laptop';
    dataValues.model_name =
      (data.specs.firmware_info && data.specs.firmware_info.model_name) || '';
    dataValues.vendor_name =
      (data.specs.firmware_info && data.specs.firmware_info.vendor_name) || '';

    api.devices.link(dataValues, (childErr, key) => {
      if (childErr || !key)
        return cb(
          childErr || new Error('Something happened. Could not register.')
        );

      secure.notify_linked(dataValues);
      logger.warn(`Device succesfully linked. Key: ${key}`);
      config.update('device_key', key, cb);
    });
  });
};

// get OS version and real name and add it to the user agent
// TODO
const setupApi = (cb) => {
  system.get_os_info((err, data) => {
    api.use({
      logger: agent.logger,
    });

    cb && cb();
  });
};

const setupKeys = (cb) => {
  let keys;
  const done = (err) => {
    cb(err, keys);
  };

  keys = {
    api: config.get('control-panel.api_key'),
    device: config.get('control-panel.device_key'),
  };

  if (keys.api && keys.api.toString().trim() !== '') {
    return done();
  }

  keys = {
    api: config.get('api_key'),
    device: config.get('device_key'),
  };

  // if found, move keys to new placeholders, and save config.
  if (keys.api && keys.api.toString().trim() !== '') {
    config.set('api_key', '');
    config.set('device_key', '');
    config.set('control-panel.api_key', keys.api);
    config.set('control-panel.device_key', keys.device);

    return config.save(done);
  }

  done();
};

exports.start = (cb) => {
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
    if (err) {
      return done(err);
    }

    setupApi(() => {
      api.keys.set(keys, (childErr) => {
        // if api is empty or both are present, stop here.
        if (childErr || api.keys.present()) {
          return done(childErr);
        }

        linkDevice((childErrTwo) => {
          if (childErrTwo) {
            logger.error(`Unable to register device: ${err.message}`);
          }
          
          done(err);
        });
      });
    });
  });
};
