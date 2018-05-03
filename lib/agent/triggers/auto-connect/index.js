var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    reconnect = require('./reconnect'),
    network   = require('./../../providers/network'),
    logger    = require('./../../common').logger.prefix('reconnect'),
    Emitter       = require('events').EventEmitter;

var emitter,
    timer = null,
    timer2 = null;

var connected = false;

var wait_normal_reconnection = function() {
  console.log("Device disconnected, waiting for reconnection: 10s");
  timer = setTimeout(function() {
    reconnect.get_open_ap_list(function(err, list) {
      if (err) return wait_normal_reconnection();
      else {
        reconnect.try_connecting_to(list, function(err, stdout) {
          if (err) return wait_normal_reconnection();
        });
      }
    });
  }, 10000)
}

var stop_waiting = function() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

exports.start = function(opts, cb) {
  hooks.on('connected', function() {
    console.log("CONNECTED!!!!!")
    network.get_active_access_point(function(err, ap) {
      reconnect.connected(ap);
    })
    stop_waiting();
  });

  hooks.on('disconnected', function() {
    console.log("DISCONNECTED!!!")
    reconnect.connected(null);
    wait_normal_reconnection();
  });

  emitter = new Emitter();
  cb(null, emitter);
}

exports.stop = function() {
  hooks.remove('connected');
  hooks.remove('disconnected');

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
}

exports.events = [];