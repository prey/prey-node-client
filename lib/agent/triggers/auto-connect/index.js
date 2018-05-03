var join          = require('path').join,
    base_path     = join(__dirname, '..', '..'),
    hooks         = require(join(base_path, 'hooks')),
    network       = require(join(base_path,'providers', 'network')),
    reconnect     = require('./reconnect'),
    common        = require('./../../common'),
    config        = common.config,
    logger        = common.logger.prefix('auto-connect'),
    Emitter       = require('events').EventEmitter;

var emitter,
    reconnect_time = 20000;
    timer = null;

var connected = false;

var wait_normal_reconnection = function() {
  logger.info("Device disconnected! Waiting for reconnection...");
  timer = setTimeout(function() {
    logger.info("Nothing happened, let's try connecting to the nearest access points");
    reconnect.get_open_ap_list(function(err, list) {
      if (err) {
        if (err.message.includes('Already connected')) stop_waiting();
        else if (err.message.includes('Connection attempted with all the open access points')) {
          stop_waiting();
          timer = 60000; // One minute
          wait_normal_reconnection();
        } else return wait_normal_reconnection();
      } else {
        reconnect.try_connecting_to(list, function(err, stdout) {
          if (err)
            if (err.message.includes('Already connected')) stop_waiting();
          else return wait_normal_reconnection();
        });
      }
    });
  }, reconnect_time)
}

var stop_waiting = function() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

exports.start = function(opts, cb) {
  hooks.on('connected', function() {
    network.get_active_access_point(function(err, ap) {
      reconnect.connected(ap);
    })
    stop_waiting();
  });

  hooks.on('disconnected', function() {
    if (config.get('auto_connect')) {
      reconnect.connected(null);
      wait_normal_reconnection();
    }
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