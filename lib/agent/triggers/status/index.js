const providers = require('../../providers');
const common = require('../../common');

const logger = common.logger.prefix('status');
const hooks = require('../../hooks');
const Emitter = require('events').EventEmitter;

let status_interval;
const battery_level = { previous: null, current: null };
exports.statusCallbacks = [];
exports.status = null;
let timeoutGetStatus;
let gotTimeoutGetStatus = false;
let emitter;
exports.timeoutGetStatusMs = 60 * 1000 * 3;

const LOW_THRESHOLD = 10;

const checkBatteryStatus = (statusInBattery) => {
  if (!statusInBattery || !statusInBattery.battery_status) return;

  try {
    battery_level.current = parseInt(statusInBattery.battery_status.percentage_remaining);
  } catch (e) {
    logger.info('Error while trying to get battery remaining percentage');
    return;
  }

  if (battery_level.previous && battery_level.previous > LOW_THRESHOLD && battery_level.current <= LOW_THRESHOLD) hooks.trigger('low_battery');

  battery_level.previous = battery_level.current;
};

exports.status_info = (cb) => {
  providers.get('status', (err, stdout) => {
    const statusStd = stdout;
    if (!err && stdout) {
      if (!statusStd.logged_user) statusStd.logged_user = 'null';
      checkBatteryStatus(statusStd);
    }
    exports.status = statusStd;
    if (cb) return cb(err, statusStd);
  });
};

// Returns the last checked status
exports.get_status = (cb, nameCallBack = '') => {
  if (nameCallBack !== '') {
    const indexFound = exports.statusCallbacks.findIndex((el) => el.nameCallBack === nameCallBack);
    if (indexFound !== -1) exports.statusCallbacks[indexFound].cb = cb;
  }
  if (exports.status) {
    if (nameCallBack !== '') {
      // eslint-disable-next-line max-len
      exports.statusCallbacks = exports.statusCallbacks.filter((el) => el.nameCallBack !== nameCallBack);
    }
    return cb(null, exports.status);
  }
  if (!timeoutGetStatus) {
    timeoutGetStatus = setTimeout(() => {
      gotTimeoutGetStatus = true;
      if (exports.status || exports.statusCallbacks.length === 0) {
        return;
      }
      const callbacksList = exports.statusCallbacks;
      exports.statusCallbacks = [];

      if (callbacksList.length >= 1) {
        callbacksList.forEach((fn) => {
          fn(null, null);
        });
      }
    }, exports.timeoutGetStatusMs);
  } else if (gotTimeoutGetStatus) {
    gotTimeoutGetStatus = false;
    clearTimeout(timeoutGetStatus);
    timeoutGetStatus = null;
  }
  if (exports.statusCallbacks.length > 5) return cb(null, null);
  exports.statusCallbacks.push({ cb, nameCallBack });

  return exports.status_info((err, statusInfo) => {
    gotTimeoutGetStatus = false;
    clearTimeout(timeoutGetStatus);
    timeoutGetStatus = null;
    exports.status = statusInfo;
    const callbacksList = exports.statusCallbacks;
    exports.statusCallbacks = [];

    if (callbacksList.length >= 1) {
      callbacksList.forEach((fn) => {
        fn.cb(err, exports.status);
      });
    }
  });
};

exports.set_status = (stat, data) => {
  if (exports.status) exports.status[stat] = data;
};

exports.start = (opts, cb) => {
  hooks.on('connected', () => {
    status_interval = setInterval(() => {
      exports.status_info();
    }, 3 * 60 * 1000); // Every 3 minutes
  });

  hooks.on('disconnected', () => {
    exports.statusCallbacks = [];
    if (timeoutGetStatus) clearInterval(timeoutGetStatus);
    clearInterval(status_interval);
  });

  hooks.on('network_state_changed', () => {
    exports.status = null;
  });

  emitter = new Emitter();
  cb(null, emitter);
};

exports.stop = (cb) => {
  hooks.remove('connected');
  hooks.remove('disconnected');
  hooks.remove('network_state_changed');
  clearInterval(status_interval);
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [];
