// @ts-check
const os = require('os');
const { join } = require('path');
const setup = require('./setup');
const sender = require('./sender');
const secure = require('./secure');
const api = require('./api');
const deviceState = require('./device-state');
const prompt = require('./prompt');
const bus = require('./bus');
const reports = require('../reports');
const hardware = require('../providers/hardware');
const websocket = require('./websockets');
const lpConf = require('../../conf/long-polling');
const common = require('../common');
const hooks = require('../hooks');
const commands = require('../commands');
const permissions = require('../permissions');
const network = require('../providers/network');
const listeners = require('../socket/listeners');
const socket = require('../socket');
const { nameArray } = require('../socket/messages');
const permissionFile = require('../../utils/permissionfile');
const { processSettingsUpdate } = require('./update-settings');

const osName = process.platform.replace('win32', 'windows');
const { stringBooleanOrEmpty } = require('../utils/utilsprey');

const { logger } = common;
const config = require('../../utils/configfile');

exports.timeout_send_info_encrypt = 8 * 60 * 60 * 1000; // Every 8 hours
/** @type {ReturnType<typeof setInterval> | null} */
let encryptIntervalId = null;

/**
 * @param {Object} opts
 * @param {Function} [cb]
 */
const init_api = (opts, cb) => {
  if (!opts) return typeof cb === 'function' && cb(new Error('Invalid config.'));
  // @ts-ignore — api.use accepts custom connection options not reflected in its declared type
  api.use({ host: opts['control-panel.host'], protocol: opts['control-panel.protocol'], try_proxy: opts.try_proxy });

  if (!cb) return;
  // if a callback was passed, then the caller expects the keys to be set as well.
  api.keys.set({
    api: opts['control-panel.api_key'],
    device: opts['control-panel.device_key'],
  }, cb);
};

/**
 * @param {string} what
 * @param {unknown} _err
 * @param {any} resp
 */
const handle_response = (what, _err, resp) => {
  if (what === 'report' && resp && resp.statusCode === 409) {
    // A 409 on a stolen report means the panel thinks the device is not missing.
    // If we have a locally-set missing state that has not been confirmed to the
    // panel yet (e.g. it was set while offline), that 409 is stale: re-assert the
    // missing state instead of recovering, otherwise we would silently lose it.
    if (deviceState.isMissingPending()) {
      logger.warn('Report 409 while missing state is pending; re-asserting, not recovering.');
      deviceState.flush(() => {});
      return;
    }
    return found();
  }
  if (resp && resp.headers['X-Prey-Commands']) commands.process(resp.body);
};

const load_hooks = () => {
  if (osName.localeCompare('windows') === 0 || osName.localeCompare('darwin') === 0) {
    hooks.on(nameArray[1], listeners.reactToCheckLocationPerms);
  }
  if (osName.localeCompare('darwin') === 0) {
    hooks.on(nameArray[0], listeners.getLocationMacSVC);
    hooks.on(nameArray[2], listeners.getPictureMacSVC);
    hooks.on(nameArray[3], listeners.getScreenshotMacSVC);
    hooks.on(nameArray[4], listeners.getScreenshotAgentMacSVC);
    hooks.on(nameArray[5], listeners.reactToWdutil);
    hooks.on(nameArray[6], listeners.reacToWatcher);
    // @ts-ignore — socket.activeToSend is a custom flag not in the declared type
    socket.activeToSend = true;
  }
  hooks.on('action', websocket.notify_action);
  hooks.on('event', sender.notify_event);
  hooks.on('data', sender.send_data);
  hooks.on('report', (name, data) => {
    const data_to_send_panel = {
      ...data,
    };
    if (name === 'specs') {
      // @ts-ignore — track_hardware_changes/track_session_changes are custom exports
      hardware.track_hardware_changes(data);
      // @ts-ignore
      hardware.track_session_changes();
    }
    sender.send_report(name, data_to_send_panel);
  });

  bus.on('response', handle_response);
};

const unload_hooks = () => {
  // hooks.remove is a custom method on the PreyHooks emitter (extends EventEmitter)
  const h = /** @type {any} */ (hooks);
  if (osName.localeCompare('windows') === 0 || osName.localeCompare('darwin') === 0) {
    h.remove(nameArray[1], listeners.reactToCheckLocationPerms);
  }
  if (osName.localeCompare('darwin') === 0) {
    h.remove(nameArray[0], listeners.getLocationMacSVC);
    h.remove(nameArray[2], listeners.getPictureMacSVC);
    h.remove(nameArray[3], listeners.getScreenshotMacSVC);
    h.remove(nameArray[4], listeners.getScreenshotAgentMacSVC);
    h.remove(nameArray[5], listeners.reactToWdutil);
    h.remove(nameArray[6], listeners.reacToWatcher);
  }
  h.remove('action', sender.notify_action);
  h.remove('event', sender.notify_event);
  h.remove('data', sender.send_data);
  h.remove('report', sender.send_report);

  bus.removeListener('response', handle_response);
};

/** @param {Function} [cb] */
const webSocketLoad = (cb) => {
  websocket.load.call(common, (err, emitter) => {
    // @ts-ignore — socket.writeMessage second arg is optional but not typed
    setInterval(() => { socket.writeMessage(nameArray[6]); }, 60 * 60 * 1000);
    if (!emitter) return;
    if (encryptIntervalId) clearInterval(encryptIntervalId);
    encryptIntervalId = setInterval(() => {
      module.exports.send_info_encrypt(() => {});
    }, exports.timeout_send_info_encrypt);
    setTimeout(() => {
      module.exports.send_info_encrypt(() => {});
    }, 20000);
    emitter.on('command', commands.perform);
  });
  typeof cb === 'function' && cb();
};

/** @param {Function} [cb] */
const boot = (cb) => {
  lpConf.unload();
  load_hooks();
  sync(true);
  setTimeout(() => {
    // @ts-ignore — socket.writeMessage second arg is optional but not typed
    socket.writeMessage(nameArray[6], () => {
      // @ts-ignore — network.isWifiPermissionActive not in declared exports
      network.isWifiPermissionActive((output) => {
        if (osName.localeCompare('windows') !== 0) {
          permissionFile.setData('wifiLocation', stringBooleanOrEmpty(output), () => {
            permissions.getLocationPermission();
            webSocketLoad(cb);
          });
        } else {
          webSocketLoad(cb);
        }
      });
    });
  }, osName.localeCompare('windows') !== 0 ? 0 : 8000);
};

/** @param {Function} cb */
const wait_for_config = (cb) => {
  logger.warn('Not configured. Waiting for user input...');
  let attempts = 0;

  const timer = setInterval(() => {
    logger.info('Reloading config...');
    config.load();

    if (config.getData('control-panel.api_key') && config.getData('control-panel.device_key')) {
      clearInterval(timer);
      const data = config.all();
      init_api(data, () => { boot(cb); });
    } else if (++attempts > 12) { // one min total
      const errorStopping = new Error('Not configured. Stopping.');
      // @ts-ignore — .level is a custom property used by the error reporting system
      errorStopping.level = 'fatal';
      throw errorStopping;
    }
  }, 10000); // 10 seconds
};

config.onDataChange('control-panel.send_encryption_keys', (newValue) => {
  if (newValue === false) {
    if (encryptIntervalId) {
      clearInterval(encryptIntervalId);
      encryptIntervalId = null;
    }
  } else if (!encryptIntervalId) {
    encryptIntervalId = setInterval(() => {
      module.exports.send_info_encrypt(() => {});
    }, exports.timeout_send_info_encrypt);
    module.exports.send_info_encrypt(() => {});
  }
});

/** @param {Function} cb */
module.exports.send_info_encrypt = function (cb) {
  if (config.getData('control-panel.send_encryption_keys') === false) {
    return typeof cb === 'function' && cb();
  }
  /** @type {{ os_edition?: string, winsvc_version?: string, os_name?: string }} */
  const data = {};
  const os_name = os.platform().replace('win32', 'windows').replace('darwin', 'mac');
  const system = require(join('../../system', os_name));

  if (os_name == 'windows') {
    system.get_os_edition((err, os_edition) => {
      if (err) return cb(new Error('Error to get os_edition information'));
      data.os_edition = os_edition;
      system.get_winsvc_version((errVersion, winsvc_version) => {
        if (errVersion) return cb(new Error('Error to get winsvc_version information'));
        data.winsvc_version = winsvc_version;
        data.os_name = os_name;
        if (config.getData('control-panel.api_key') && config.getData('control-panel.device_key') && (system.compatible_with_module_tpm(data))) {
          commands.run('get', 'encryption_status');
          commands.run('get', 'encryption_keys');
        }
        return typeof cb === 'function' && cb();
      });
    });
  } else {
    return typeof (cb) === 'function' && cb(new Error('Action only allowed on Windows'));
  }
};

/**
 * @param {Object} opts
 */
const missing = (opts) => {
  logger.info('Device seems to be missing.');
  commands.run('report', 'stolen', opts);
};

const scan_hardware = () => {
  setTimeout(() => {
    commands.run('get', 'specs');
  }, 10000);
};

const found = () => {
  logger.info('Device no longer missing.');
  // Drop any lingering missing intent so it can't be re-asserted later.
  deviceState.clear(() => {});
  commands.run('cancel', 'stolen');
};

/**
 * @param {boolean} [clientStart]
 */
const sync = (clientStart) => {
  api.devices.get.status((err, response) => {
    const result = response && response.body;
    if (!result || (response && response.statusCode > 300)) { return logger.warn('Unable to sync settings.'); }

    if (err) { return setTimeout(sync, 10000); }
    if (result.settings) { update_settings(result.settings); }

    if (result.location && Array.isArray(result.location.disabled_methods)) {
      config.setData('control-panel.location.disabled_methods', result.location.disabled_methods);
    } else if (result.location) {
      config.setData('control-panel.location.disabled_methods', []);
    }

    if (clientStart) {
      // Reconcile local missing intent with the panel. If we have a missing
      // state that was set locally but never confirmed (e.g. set while offline),
      // keep it even when the panel still reports not-missing, and let the
      // background delivery push it up — do not let the stale panel status win.
      deviceState.loadFromStorage((_err, localMissingPending) => {
        const isStolen = reports.running().some((e) => e.name == 'stolen');
        const backendMissing = !!(result.status && result.status.missing === true);
        if (!isStolen && (backendMissing || localMissingPending)) {
          if (localMissingPending && !backendMissing) {
            logger.warn('Local missing pending while panel reports not-missing; keeping missing.');
          }
          const opts = {
            interval: (result.status && result.status.delay) || 20,
            exclude: result.status && result.status.exclude,
          };
          missing(opts);
        }
      });

      if (result.running_actions && result.running_actions.length > 1) {
        logger.warn(`Restarting ${result.running_actions.length} actions!`);
        result.running_actions.forEach(commands.perform);
      }

      if (config.getData('control-panel.scan_hardware')) { scan_hardware(); }
    }
  });
};

/**
 * @param {Object} obj
 */
const update_settings = (obj) => {
  logger.debug('Syncing settings.');
  processSettingsUpdate(obj);
};

/** @param {Function} cb */
exports.setup = (cb) => {
  const data = config.all();
  init_api(data);
  prompt.start((err, key) => {
    if (err) return cb(err);
    cb(null, { api_key: key });
  });
};

/**
 * @param {Function} cb
 * @param {string} [flag='']
 */
exports.enabled = (cb, flag = '') => {
  const data = config.all();
  init_api(data);
  setup.start(common, cb, flag);
};

/** @param {Function} cb */
exports.disabled = (cb) => {
  const data = config.all();
  // eslint-disable-next-line consistent-return
  init_api(data, (err) => {
    if (err) return cb();

    // eslint-disable-next-line consistent-return
    api.devices.unlink((error) => {
      const failed = error && (/** @type {any} */ (error).code !== 'MISSING_KEY' && /** @type {any} */ (error).code !== 'INVALID_CREDENTIALS');
      if (failed) return cb(error);
      config.setData('control-panel.device_key', '');
      // config.save(cb);
    });
  });
};

/** @param {Function} [cb] */
exports.load = (cb) => {
  if (!config) return typeof cb === 'function' && cb(new Error('No config object.'));
  const data = config.all();
  const initOpts = data;
  initOpts.try_proxy = config.getData('try_proxy');

  init_api(initOpts);
  sender.init(common);

  secure.generate_keys((err) => {
    if (err) logger.warn(err.message);
    setup.start(common, (error) => {
      if (!error) return boot(cb);
      if (!common.helpers.running_on_background()) {
        typeof cb === 'function' && cb(error);
      } else {
        lpConf.load(() => {
          wait_for_config(cb);
        });
      }
    });
  });
};

/** @param {Function} [cb] */
exports.unload = (cb) => {
  unload_hooks();
  websocket.unload(cb);
};

/**
 * @param {Object} opts
 * @param {Function} [cb]
 */
exports.load_api = (opts, cb) => {
  init_api(opts, cb);
  return api;
};

exports.sync = sync;
