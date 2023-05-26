var join = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks = require(join(base_path, 'hooks')),
    network = require(join(base_path, 'providers', 'network')),
    Emitter = require('events').EventEmitter;

var emitter,
    status, // either connected or disconnected
    checking = false;

var timer,
    attempt = 0,
    attempts_delays = [ 3, 3, 5, 10, 20, 30, 60, 2*60 ];

var check_status = function() {  
  if (checking) return;
  checking = true;

  network.get_connection_status(function(new_status) {
    checking = false;

    // If there's a disconnected event triggered, the connection is checked on time intervals
    if (new_status != 'connected') {
      var index = attempt;
      if (attempt >= attempts_delays.length - 1) index = attempts_delays.length - 1;
      timer = setTimeout(check_status, attempts_delays[index] * 1000)
      attempt++;
    } else {
      attempt = 0;
    }

    if (new_status != status) {
      hooks.trigger(new_status);
      // trigger directly the event instead of emitting it to the actions manager
      status = new_status;
    }
  });
}

exports.start = function(opts, cb) {
  check_status();
  hooks.on('network_state_changed', () => {
    clearTimeout(timer);
    attempt = 0;
    check_status();
  });
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
