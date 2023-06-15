var providers = require('./../../providers'),
    common    = require('./../../common'),
    logger    = common.logger.prefix('status'),
    hooks     = require('./../../hooks'),
    Emitter   = require('events').EventEmitter;

var status_interval,
    battery_level = { previous: null, current: null };
exports.statusCallbacks = [];
exports.status = null;
let timeoutGetStatus;
let gotTimeoutGetStatus = false;
let emitter;
exports.timeoutGetStatusMs = 60 * 1000 * 5;

var LOW_THRESHOLD = 10;

function check_battery_status(statusInBattery) {
  if (!statusInBattery || !statusInBattery.battery_status) return;

  try {
    battery_level.current = parseInt(statusInBattery.battery_status.percentage_remaining);
  } catch (e) {
    logger.info("Error while trying to get battery remaining percentage");
    return;
  }

  if (battery_level.previous && battery_level.previous > LOW_THRESHOLD && battery_level.current <= LOW_THRESHOLD)
    hooks.trigger('low_battery');

  battery_level.previous = battery_level.current;

  return;
}

exports.status_info = (cb) => {
  providers.get('status', (err, stdout) => {
    let statusStd = stdout;
    if (!err && stdout) {
      if (!statusStd.logged_user) statusStd.logged_user = 'null';
      check_battery_status(statusStd);
    }
    if (cb) return cb(err, statusStd);
    return;
  });
};

// Returns the last checked status
exports.get_status = (cb) => {
  if (exports.status) {
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
  // if (cb.toString() != 'null' && cb != null)
  if (exports.statusCallbacks.length > 5) return cb(null, null);
  exports.statusCallbacks.push(cb);

  // if (statusCallbacks.length > 1) return;

  return exports.status_info((err, statusInfo) => {
    gotTimeoutGetStatus = false;
    clearTimeout(timeoutGetStatus);
    timeoutGetStatus = null;
    exports.status = statusInfo;
    const callbacksList = exports.statusCallbacks;
    exports.statusCallbacks = [];

    if (callbacksList.length >= 1) {
      callbacksList.forEach((fn) => {
        fn(err, exports.status);
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
