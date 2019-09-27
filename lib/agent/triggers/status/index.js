var providers = require('./../../providers'),
    common    = require('./../../common'),
    logger    = common.logger.prefix('status'),
    hooks     = require('./../../hooks'),
    Emitter   = require('events').EventEmitter;

var status,
    status_interval,
    status_callbacks = [],
    battery_level = { previous: null, current: null };

var LOW_THRESHOLD = 10;

function check_battery_status(status) {
  if (!status || !status.battery_status) return;

  try {
    battery_level.current = parseInt(status.battery_status.percentage_remaining);
  } catch (e) {
    logger.info("Error while trying to get battery remaining percentage");
    return;
  }

  if (battery_level.previous && battery_level.previous > LOW_THRESHOLD && battery_level.current <= LOW_THRESHOLD)
    hooks.trigger('low_battery');

  battery_level.previous = battery_level.current;

  return;
}

function status_info(cb) {
  providers.get('status', (err, stdout) => {
    if (!err && stdout) {
      status = stdout;

      if (!status.logged_user)
        status.logged_user = 'null';
      
      check_battery_status(status);
    }
    if (cb) return cb(err, status);
    return;
  })
}

// Returns the last checked status
exports.get_status = (cb) => {
  if (status) {
    return cb(null, status);
  }

  // if (cb.toString() != 'null' && cb != null)
  status_callbacks.push(cb);

  if (status_callbacks.length > 1) return;

  status_info((err, status) => {
    var callbacks_list = status_callbacks;
    status_callbacks = [];

    if (callbacks_list.length >= 1) {
      callbacks_list.forEach(function(fn) {
        fn(err, status);
      });
    }
  })
}

exports.set_status = (stat, data) => {
  if (status) status[stat] = data
}

exports.start = (opts, cb) => {
  hooks.on('connected', () => {
    status_interval = setInterval(() => {
      status_info();
    }, 3 * 60 * 1000)   // Every 3 minutes
  })

  hooks.on('disconnected', () => {
    status_callbacks = [];
    clearInterval(status_interval);
  })

  hooks.on('network_state_changed', () => {
    status = null;
  })

  emitter = new Emitter();
  cb(null, emitter)
}

exports.stop = (cb) => {
  hooks.remove('connected');
  hooks.remove('disconnected');
  hooks.remove('network_state_changed');
  clearInterval(status_interval);
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
}

exports.events = [];