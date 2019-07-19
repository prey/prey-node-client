var providers = require('./../../providers'),
    Emitter     = require('events').EventEmitter;

var status,
    status_interval;

function status_info(cb) {
  providers.get('status', (err, stdout) => {
    if (!err) status = stdout;
    return cb(err, stdout);
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
    status_info(() => {
      check_logged_user();
    });
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