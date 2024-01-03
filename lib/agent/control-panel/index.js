const os = require('os');
const { join } = require('path');
const setup = require('./setup');
const sender = require('./sender');
const secure = require('./secure');
const api = require('./api');
const prompt = require('./prompt');
const bus = require('./bus');
const reports = require('../reports');
const hardware = require('../providers/hardware');
const websocket = require('./websockets');
const lp_conf = require('../../conf/long-polling');
const common = require('../common');
const hooks = require('../hooks');
const commands = require('../commands');

const { logger } = common;
const config = require('../../utils/configfile');

const init_api = (opts, cb) => {
  if (!opts) return cb && cb(new Error('Invalid config.'));

  api.use({
    host: opts.host,
    protocol: opts.protocol,
    try_proxy: opts.try_proxy,
  });

  if (!cb) return;
  const asd = {
    api: opts['control-panel.api_key'],
    device: opts['control-panel.device_key'],
  };
  logger.info(`data to keys: ${JSON.stringify(asd)}`);
  // if a callback was passed, then the called
  // expects the keys to be set as well.
  api.keys.set({
    api: opts['control-panel.api_key'],
    device: opts['control-panel.device_key'],
  }, cb);
};

const handle_response = (what, err, resp) => {
  if (what === 'report' && (resp && resp.statusCode === 409)) { found(); } else if (resp && resp.headers['X-Prey-Commands']) { commands.process(resp.body); }
};

const load_hooks = () => {
  hooks.on('action', websocket.notify_action);
  hooks.on('event', sender.notify_event);
  hooks.on('data', sender.send_data);
  hooks.on('report', (name, data) => {
    const data_to_send_panel = {
      ...data,
    };
    if (name === 'specs') hardware.track_hardware_changes(data);
    sender.send_report(name, data_to_send_panel);
  });

  bus.on('response', handle_response);
};

const unload_hooks = () => {
  hooks.remove('action', sender.notify_action);
  hooks.remove('event', sender.notify_event);
  hooks.remove('data', sender.send_data);
  hooks.remove('report', sender.send_report);

  bus.removeListener('response', handle_response);
};

const boot = (cb) => {
  load_hooks();
  sync();
  websocket.load.call(common, (err, emitter) => {
    if (!emitter) return;
    setInterval(() => {
      module.exports.send_info_encrypt(() => {
      });
    }, exports.timeout_send_info_encrypt);
    emitter.on('command', commands.perform);
  });
  cb && cb();
};

const wait_for_config = (cb) => {
  logger.warn('Not configured. Waiting for user input...');
  let attempts = 0;

  const timer = setInterval(() => {
    logger.info('Reloading config...');
    config.load();

    if (config.getData('control-panel.api_key') && config.getData('control-panel.device_key')) {
      clearInterval(timer);
      // set the new keys in the api before booting
      config.all((data) => {
        init_api(data, () => { boot(cb); });
      });
    } else if (++attempts > 6) { // one min total
      throw new Error('Not configured. Stopping.');
    }
  }, 10000); // 10 seconds
};

exports.timeout_send_info_encrypt = 8 * 60 * 60 * 1000; // Every 8 hours

module.exports.send_info_encrypt = function (cb) {
  const data = {};
  const os_name = os.platform().replace('win32', 'windows').replace('darwin', 'mac');
  const system = require(join('../../system', os_name));

  if (os_name == 'windows') {
    system.get_os_edition((err, os_edition) => {
      if (err) return cb(new Error('Error to get os_edition information'));
      data.os_edition = os_edition;
      system.get_winsvc_version((err, winsvc_version) => {
        if (err) return new Error('Error to get winsvc_version information');
        data.winsvc_version = winsvc_version;
        data.os_name = os_name;
        if (config.getData('control-panel.api_key') && config.getData('control-panel.device_key') && (system.compatible_with_module_tpm(data))) {
          commands.run('get', 'encryption_status');
          commands.run('get', 'encryption_keys');
        }
      });
    });
  } else {
    return typeof (cb) === 'function' && cb(new Error('Action only allowed on Windows'));
  }
};

const missing = (opts) => {
  logger.info('Device seems to be missing.');
  commands.run('report', 'stolen', opts);
};

const scan_hardware = () => {
  commands.run('get', 'specs');
};

const found = () => {
  logger.info('Device no longer missing.');
  commands.run('cancel', 'stolen');
};

const sync = () => {
  api.devices.get.status((err, response) => {
    const result = response && response.body;
    if (!result || (response && response.statusCode > 300)) { return logger.warn('Unable to sync settings.'); }

    if (err) { return setTimeout(sync, 10000); }
    if (result.settings) { update_settings(result.settings); }

    // Check if it's already stolen before mark as missing again
    const is_stolen = reports.running().some((e) => e.name == 'stolen');
    if (result.status && result.status.missing === true && !is_stolen) {
      const opts = {
        interval: result.status.delay || 20,
        exclude: result.status.exclude,
      };
      missing(opts);
    }

    if (result.running_actions && result.running_actions.length > 1) {
      logger.warn(`Restarting ${result.running_actions.length} actions!`);
      result.running_actions.forEach(commands.perform);
    }

    if (config.getData('control-panel.scan_hardware')) { scan_hardware(); }
  });
};

const update_settings = (obj) => {
  logger.debug('Syncing settings.');

  function process(values, target, locals = false) {
    Object.keys(values).forEach((key) => {
      if (values[key] == null) {
        // eslint-disable-next-line no-param-reassign
        values[key] = false;
      }

      const newValue = locals ? `control-panel.${key}` : key;

      if (
        typeof values[key] !== 'undefined'
        && config.getData(newValue) !== values[key]
      ) {
        logger.notice(`Updating value of ${key} to ${values[key]}`);
        config.setData(newValue, values[key]);
      }
    });

    // target.save();
  }

  if (obj.global) {
    process(obj.global, config);
  }

  if (obj.local) {
    process(obj.local, config, true);
  }
};

exports.setup = (cb) => {
  config.all((data) => {
    init_api(data);
    prompt.start((err, key) => {
      if (err) return cb(err);
      cb(null, { api_key: key });
    });
  });
};

exports.enabled = (cb) => {
  config.all((data) => {
    init_api(data);
    setup.start(common, cb);
  });
};

exports.disabled = (cb) => {
  config.all((data) => {
    init_api(data, (err) => {
      if (err) return cb();

      api.devices.unlink((error) => {
        const failed = error && (error.code !== 'MISSING_KEY' && error.code !== 'INVALID_CREDENTIALS');
        if (failed) return cb(error);
        config.setData('control-panel.device_key', '');
        // config.save(cb);
      });
    });
  });
};

exports.load = (cb) => {
  if (!config) return cb && cb(new Error('No config object.'));
  config.all((data) => {
    const initOpts = data;
    logger.info(`initOpts: ${JSON.stringify(initOpts)}`);
    initOpts.try_proxy = config.getData('try_proxy');

    init_api(initOpts);
    sender.init(common);

    secure.generate_keys((err) => {
      if (err) logger.warn(err.message);
      setup.start(common, (error) => {
        if (!error) return boot(cb);
        if (!common.helpers.running_on_background()) {
          cb && cb(error);
        } else {
          lp_conf.load(() => {
            wait_for_config(cb);
          });
        }
      });
    });
  });
};

exports.unload = (cb) => {
  unload_hooks();
  websocket.unload(cb);
};

exports.load_api = (opts, cb) => {
  init_api(opts, cb);
  return api;
};

exports.get_setting = (key) => {
  config.getData(key);
};

exports.update_setting = (key, value) => {
  config.load(() => {
    if (typeof value !== 'undefined' && config.getData(key) !== value) {
      logger.notice(`Updating value of ${key} to ${value}`);
      config.setData(key, value);
    }
  });
  // config.save();
};
