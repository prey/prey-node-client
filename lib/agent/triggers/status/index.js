var providers = require('./../../providers'),
    common    = require('./../../common'),
    logger    = common.logger.prefix('status'),
    hooks     = require('./../../hooks'),
    Emitter   = require('events').EventEmitter;

var status,
    status_interval,
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
      if (!stdout.logged_user)
        status.logged_user = 'null';
      
      status = stdout;
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
  status_info(cb);
}

exports.start = (opts, cb) => {
  status_interval = setInterval(() => {
    status_info();
  }, 3 * 60 * 1000)   // Every 3 minutes

  emitter = new Emitter();
  cb(null, emitter)
}

exports.stop = (cb) => {
  clearInterval(status_interval);
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
}

exports.events = [];