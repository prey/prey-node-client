var resolve   = require('dns').resolve,
    join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    Emitter   = require('events').EventEmitter;

var emitter,
    status, // either connected or disconnected
    target   = 'www.google.com',
    checking = false,
    reconnect_timeout = 15000;

var is_connected = function(cb) {
  resolve(target, function(err) {
    var result = err ? 'disconnected' : 'connected';
    cb(result);
  });
}

var check_status = function() {
  if (checking) return;

  checking = true;
  is_connected(function(new_status) {
    // logger.info('Checked status. Result: ' + new_status)

    if (status != new_status) {
      // emitter.emit(new_status);
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
