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
  is_online({
    timeout: 1000,
    retries: 0
  })
  .then(function() { cb('connected'); })
  .catch(function() { cb('disconnected'); })
}

var check_status = function() {
  if (checking) return;

  checking = true;
  get_current_status(function(current_status) {
    if (status != current_status || (status == current_status && status == 'disconnected')) {
      network.get_connection_status(function(new_status) {
        checking = false;
        if (new_status != status) {
          hooks.trigger(new_status);
          // trigger directly the event instead of emitting it to the actions manager
          status = new_status;
        }
      });
    }
    else checking = false;
  });
}

exports.start = function(opts, cb) {
  check_status();
  hooks.on('network_state_changed', check_status);
  hooks.on('disconnect', network.reset_active_access_point);
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
  hooks.remove('disconnect');
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
