var join = require('path').join,
    is_online = require('internet-available'),
    base_path = join(__dirname, '..', '..'),
    hooks = require(join(base_path, 'hooks')),
    network = require(join(base_path, 'providers', 'network')),
    Emitter = require('events').EventEmitter;

var emitter,
    status, // either connected or disconnected
    checking = false,
    interval_checker;

var get_current_status = function(cb) {
  is_online({ retries: 0 })
  .then(cb('connected'))
  .catch(function() {
    network.get_connection_status(function(new_status) {
      cb(new_status);
    });
  })
}

var check_status = function() {
  if (checking) return;

  checking = true;
  get_current_status(function(new_status) {
    if (status != new_status) {
      // trigger directly the event instead of emitting it to the actions manager
      hooks.trigger(new_status);
    }

    status = new_status;
    checking = false;
  });
}

exports.start = function(opts, cb) {
  check_status();
  hooks.on('network_state_changed', check_status);
  // Connection Heartbeat
  // todo @lemavri Dinamically change interval from
  // 15-60 seconds if status remains. Reset otherwise
  interval_checker = setInterval(function() {
    check_status();
  }, 15000);
  emitter = new Emitter();
  cb(null, emitter)
}

exports.stop = function(cb) {
  hooks.remove('network_state_changed', check_status);
  clearInterval(interval_checker);
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
}

// by leaving empty this, we make sure that the connected/disconnected
// events are not captured by the actions manager, and not reported
// as trigger events to the servers.
// exports.events = [ 'connected', 'disconnected' ];
exports.events = [];
