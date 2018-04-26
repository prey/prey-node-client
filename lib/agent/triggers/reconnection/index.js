var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    logger    = require('./../../common').logger.prefix('reconnect'),
    connect   = require('./../../plugins/auto-connect'),
    Emitter   = require('events').EventEmitter;

var emitter,
    timer = null,
    timer2 = null;

var connected = false;

var wait_normal_reconnection = function() {
  console.log("Device disconnected, waiting for reconnection: 10s");
  timer = setTimeout(connect.reconnect, 10000)
}

var stop_waiting = function() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

exports.start = function(opts, cb) {
  hooks.on('disconnected', function() {
    console.log("DISCONNECTED!!!")
    system.connected();
    wait_normal_reconnection();
  });

  hooks.on('connected', function(ap) {
    console.log("CONNECTED!!!!!")
    system.connected(ap);
    stop_waiting();
  });

  emitter = new Emitter();
  cb(null, emitter);
};

exports.stop = function() {
  hooks.remove('disconnected');
  hooks.remove('connected');
  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.events = [];
