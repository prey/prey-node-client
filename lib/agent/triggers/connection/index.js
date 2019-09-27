var join = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks = require(join(base_path, 'hooks')),
    network = require(join(base_path, 'providers', 'network')),
    Emitter = require('events').EventEmitter;

var emitter,
    status, // either connected or disconnected
    checking = false;

var check_status = function() {
  if (checking) return;
  checking = true;

  network.get_connection_status(function(new_status) {
    checking = false;
    if (new_status != status) {
      hooks.trigger(new_status);
      // trigger directly the event instead of emitting it to the actions manager
      status = new_status;
    }
  });
}

exports.start = function(opts, cb) {
  check_status();
  hooks.on('network_state_changed', check_status);
  // Connection Heartbeat
  // todo @lemavri Dinamically change interval from
  // 15-60 seconds if status remains. Reset otherwise

  emitter = new Emitter();
  cb(null, emitter)
}

exports.stop = function(cb) {
  hooks.remove('network_state_changed', check_status);
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
