/* eslint-disable operator-linebreak */
const os = require('os');

const osName = os
  .platform()
  .replace('win32', 'windows')
  .replace('darwin', 'mac');
const system = require('./../../system', osName);
const setup = require('./setup');
const sender = require('./sender');
const secure = require('./secure');
const hooks = require('../hooks');
const commands = require('../commands');
const api = require('./api');
const prompt = require('./prompt');
const bus = require('./bus');
const reports = require('../reports');
const hardware = require('../providers/hardware');
const websocket = require('./websockets');
const lpConf = require('../../conf/long-polling');
const common = require('../../common');

const { logger, config } = common;

function found() {
  logger.info('Device no longer missing.');
  commands.run('cancel', 'stolen');
}

function handleResponse(what, _, resp) {
  if (what === 'report' && resp && resp.statusCode === 409) {
    found();
  } else if (resp && resp.headers['X-Prey-Commands']) {
    commands.process(resp.body);
  }
}

function updateSettings(obj) {
  logger.debug('Syncing settings.');

  function process(values, target, locals = false) {
    Object.keys(values).forEach((key) => {
      if (values[key] == null) {
        // eslint-disable-next-line no-param-reassign
        values[key] = false;
      }

      const newValue = locals ? `control-panel.${key}` : key;
      
      if (
        typeof values[key] !== 'undefined' &&
        config.get(newValue) !== values[key]
      ) {
        logger.notice(`Updating value of ${key} to ${values[key]}`);
        config.set(newValue, values[key]);
      }
    });

    target.save();
  }

  if (obj.global) {
    process(obj.global, config);
  }

  if (obj.local) {
    process(obj.local, config, true);
  }
}

function missing(opts) {
  logger.info('Device seems to be missing.');
  commands.run('report', 'stolen', opts);
}

function scanHardware() {
  commands.run('get', 'specs');
}

// eslint-disable-next-line consistent-return
const initApi = (opts, cb) => {
  if (!opts) {
    return cb && cb(new Error('Invalid config.'));
  }

  api.use({
    host: opts.host,
    protocol: opts.protocol,
    try_proxy: opts.try_proxy,
  });

  if (!cb) {
    return undefined;
  }

  // if a callback was passed, then the called
  // expects the keys to be set as well.
  api.keys.set({ api: opts.api_key, device: opts.device_key }, cb);
};

function loadHooks() {
  // main agent hooks
  hooks.on('action', websocket.notify_action);
  hooks.on('event', sender.notify_event);
  hooks.on('data', sender.send_data);
  hooks.on('report', (name, data) => {
    if (name === 'specs') {
      hardware.track_hardware_changes(data);
    }
    sender.send_report(name, { ...data });
  });

  // this is triggered from this own plugin's sender module
  bus.on('response', handleResponse);
}

function sync() {
  // eslint-disable-next-line consistent-return
  api.devices.get.status((err, response) => {
    const result = response && response.body;

    if (!result || (response && response.statusCode > 300)) {
      logger.warn('Unable to sync settings.');
    }

    if (err) return setTimeout(sync, 10000);

    if (result.settings) updateSettings(result.settings);

    // Check if it's already stolen before mark as missing again
    const isStolen = reports.running().some((e) => e.name === 'stolen');
    if (result.status && result.status.missing === true && !isStolen) {
      missing({
        interval: result.status.delay || 20,
        exclude: result.status.exclude,
      });
    }

    if (result.running_actions && result.running_actions.length > 1) {
      logger.warn(`Restarting ${result.running_actions.length} actions!`);
      result.running_actions.forEach(commands.perform);
    }

    if (config.get('scan_hardware')) {
      scanHardware();
    }
  });
}

function boot(cb) {
  loadHooks();
  sync();

  websocket.load.call(common, (_, emitter) => {
    if (!emitter) {
      return;
    }
    setInterval(() => {
      // send this every 8 hours
      module.exports.send_info_encrypt(() => {});
    }, 8 * 60 * 60 * 1000);
    emitter.on('command', commands.perform);
  });

  if (cb) {
    cb();
  }
}

const waitForConfig = (cb) => {
  logger.warn('Not configured. Waiting for user input...');
  let attempts = 0;
  const timer = setInterval(() => {
    logger.info('Reloading config...');
    config.reload();

    attempts += 1;
    if (config.get('api_key') && config.get('device_key')) {
      clearInterval(timer);
      // set the new keys in the api before booting
      initApi(config.all(), () => {
        boot(cb);
      });
    } else if (attempts > 6) {
      // one min total
      throw new Error('Not configured. Stopping.');
    }
  }, 10000); // 10 seconds
};

function unloadHooks() {
  hooks.remove('action', sender.notify_action);
  hooks.remove('event', sender.notify_event);
  hooks.remove('data', sender.send_data);
  hooks.remove('report', sender.send_report);
  bus.removeListener('response', handleResponse);
}

// eslint-disable-next-line consistent-return
module.exports.send_info_encrypt = (cb) => {
  if (osName !== 'windows') {
    return (
      typeof cb === 'function' &&
      cb(new Error('Action only allowed on Windows'))
    );
  }

  // eslint-disable-next-line consistent-return
  system.get_os_edition((err, osEdition) => {
    const data = {};
    if (err) {
      return cb(new Error('Error to get os_edition information'));
    }

    data.os_edition = osEdition;
    // eslint-disable-next-line consistent-return
    system.get_winsvc_version((childErr, winsvcVersion) => {
      if (childErr) {
        return new Error('Error to get winsvc_version information');
      }
      data.winsvc_version = winsvcVersion;
      data.osName = osName;

      if (
        config.get('api_key') &&
        config.get('device_key') &&
        system.compatible_with_module_tpm(data)
      ) {
        commands.run('get', 'encryption_status');
        commands.run('get', 'encryption_keys');
      }
    });
  });
};

/// exports
exports.setup = (cb) => {
  // we need to comment this out, as it prevents the 'config account setup --force'
  // option to work. normally this plugin will not be enabled via 'config plugins enable foo'
  // so let's just leave it out for now. plugin fiddlers can manage. :)
  initApi(this.config.all());
  // eslint-disable-next-line consistent-return
  prompt.start((err, key) => {
    if (err) {
      return cb(err);
    }

    cb(null, { api_key: key });
  });
};

// called from conf module after plugin is setup
// calls setup to ensure device is linked.
exports.enabled = (cb) => {
  initApi(this.config.all());
  setup.start(this, cb);
};

// called when plugin is disabled, either via the plugin manager
// or when the running the pre_uninstall hooks.
exports.disabled = (cb) => {
  // eslint-disable-next-line consistent-return
  initApi(config.all(), (err) => {
    if (err) return cb(); // keys are missing, so just return

    // eslint-disable-next-line consistent-return
    api.devices.unlink((childErr) => {
      // only return if we had a non-key related error
      const failed =
        childErr &&
        childErr.code !== 'MISSING_KEY' &&
        childErr.code !== 'INVALID_CREDENTIALS';

      if (failed) {
        return cb(childErr);
      }

      // ok, so device was unlinked. let's clear the device key but NOT
      // the API key. that way, if we're upgrading via a package manager
      // (e.g. apt-get) we don't lose scope of the user's account API key.
      // so whenever the post_install hooks are called and the agent is
      // called, it will automatically relink the device to the account.
      config.set('device_key', '');
      config.save(cb);
    });
  });
};

// eslint-disable-next-line consistent-return
exports.load = (cb) => {
  if (!config.all()) {
    return cb && cb(new Error('No config object.'));
  }

  const initOpts = config.all();
  initOpts.try_proxy = config.get('try_proxy');

  initApi(initOpts);
  sender.init(common);

  secure.generate_keys((err) => {
    if (err) {
      logger.warn(err.message);
    }

    // eslint-disable-next-line consistent-return
    setup.start(common, (childErr) => {
      logger.info(childErr);
      if (!childErr) {
        return boot(cb);
      }

      if (!helpers.running_on_background()) {
        logger.info('2');
        return cb && cb(childErr);
      }

      lpConf.load(() => {
        logger.info('3');
        waitForConfig(cb);
      });
    });
  });
};

exports.unload = (cb) => {
  unloadHooks();
  websocket.unload(cb);
};

// export API for conf module
exports.load_api = (opts, cb) => {
  initApi(opts, cb);
  return api;
};

exports.get_setting = (key) => {
  config.get(key);
};

exports.update_setting = (key, value) => {
  if (typeof value !== 'undefined' && config.get(key) !== value) {
    logger.notice(`Updating value of ${key}  to ${value}`);
    config.set(key, value);
  }
  config.save();
};
