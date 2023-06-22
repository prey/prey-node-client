const api = require('./api');
const secure = require('./secure');
const common = require('../common');
const providers = require('../providers');
const system = require('../../system');

const { config } = common;
let agent;
let running = false;
let logger = {};

['debug', 'info', 'warn', 'error'].forEach((k) => {
  logger[k] = console.log;
});

const link_device = (cb) => {
  get_device_data(function (err, data) {
    if (err) return cb(err);

    data.name = system.get_device_name();
    data.device_type =
      (data.specs.firmware_info && data.specs.firmware_info.device_type) ||
      'Laptop';
    data.model_name =
      (data.specs.firmware_info && data.specs.firmware_info.model_name) || '';
    data.vendor_name =
      (data.specs.firmware_info && data.specs.firmware_info.vendor_name) || '';

    api.devices.link(data, function (err, key) {
      if (err || !key)
        return cb(err || new Error('Something happened. Could not register.'));

      secure.notify_linked(data);
      logger.warn('Device succesfully linked. Key: ' + key);
      config.update('device_key', key, cb);
    });
  });
};

var get_device_data = function (callback) {
  logger.info('Gathering device data...');
  var e,
    data = {},
    count = 3;

  var done = function (err, new_data) {
    if (err) {
      e = err;
    } else {
      for (var key in new_data) {
        data[key] = new_data[key];
      }
    }
    --count || callback(e, data);
  };

  providers.get('specs', function (err, data) {
    done(err, { specs: data });
  });

  system.get_os_name(function (err, name) {
    done(err, { os: name });
  });

  system.get_os_version(function (err, ver) {
    done(err, { os_version: ver });
  });
};

// get OS version and real name and add it to the user agent
var setup_api = function (cb) {
  system.get_os_info(function (err, data) {
    api.use({
      logger: agent.logger,
    });

    cb && cb();
  });
};

var setup_keys = function (cb) {
  var done = function (err) {
    cb(err, keys);
  };

  var keys = {
    api: config.get('control-panel.api_key'),
    device: config.get('control-panel.device_key'),
  };

  if (keys.api && keys.api.toString().trim() != '') return done();

  var keys = {
    api: config.get('api_key'),
    device: config.get('device_key'),
  };

  // if found, move keys to new placeholders, and save config.
  if (keys.api && keys.api.toString().trim() != '') {
    config.set('api_key', '');
    config.set('device_key', '');
    config.set('control-panel.api_key', keys.api);
    config.set('control-panel.device_key', keys.device);

    return config.save(done);
  }

  done();
};

exports.start = function (cb) {
  if (running) return cb(new Error('Setup in progress.'));

  var done = function (err) {
    running = false;
    cb(err);
  };

  running = true;
  agent = common;
  logger = common.logger;

  // check existing or keys from previous config file.
  setup_keys(function (err, keys) {
    if (err) return done(err);

    setup_api(function () {
      api.keys.set(keys, function (err) {
        // if api is empty or both are present, stop here.
        if (err || api.keys.present()) return done(err);

        link_device(function (err) {
          if (err) logger.error('Unable to register device: ' + err.message);
          done(err);
        });
      });
    });
  });
};
