var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    network   = require(join(base_path,'providers', 'network')),
    reconnect = require('./reconnect'),
    common    = require('./../../common'),
    os_name   = process.platform.replace('darwin', 'mac').replace('win32', 'windows'),
    config    = common.config,
    logger    = common.logger.prefix('auto-connect'),
    Emitter   = require('events').EventEmitter;

var emitter,
    reconnect_time = 30000,
    was_disconnected = false;
    timer = null;

var connected = false;

var restart_reconnection = function() {
  stop_waiting();
  reconnect_time = 1000 * 60 * 3; // Three minutes
  wait_normal_reconnection();
}

var check_err = function(err) {
  logger.info(err);
  if (err.message.includes('Already connected')) {
    logger.info(err.message + ". Autoconnect disengaged for now :)")
    stop_waiting();
  }
  else restart_reconnection();
}

var wait_normal_reconnection = function() {
  logger.info("Device disconnected! Waiting for reconnection...");
  reconnect.enable_wifi(function() {
    timer = setTimeout(function() {
      logger.info("Nothing happened, let's try connecting to the nearest access points...");
      reconnect.get_open_ap_list(function(err, list) {
        if (err) return check_err(err);
        reconnect.try_connecting_to(list, function(err, stdout) {
          if (err) return check_err(err);
          return wait_normal_reconnection();
        });
      });
    }, reconnect_time)
  })
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
      if (was_disconnected) {
        logger.info("Connection achieved! " + (ap ? ap.ssid || "" : ""));
        was_disconnected = false;
      }
      connected = ap;
      reconnect.connected(ap);
    })
    stop_waiting();
  });

  hooks.on('disconnected', function() {
    was_disconnected = true;
    connected = false;
    if (config.get('auto_connect') && os_name != 'linux') {
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