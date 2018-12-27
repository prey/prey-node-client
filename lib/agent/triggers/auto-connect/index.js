var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    network   = require(join(base_path,'providers', 'network')),
    reconnect = require('./reconnect'),
    common    = require('./../../common'),
    config    = common.config,
    logger    = common.logger.prefix('auto-connect'),
    Emitter   = require('events').EventEmitter;

var emitter,
    reconnect_time = 10000,
    running = false,
    sleeping = false,
    was_disconnected = false,
    timer = null;

var connected = false;

var restart_reconnection = () => {
  stop_waiting();
  reconnect_time = 1000 * 60 * 1; // Three minutes
  wait_normal_reconnection();
}

var check_err = (err) => {
  logger.debug(err);
  if (err.message.includes('Already connected') ||
      err.message.includes('Device on sleeping state') ||
      err.message.includes('Unable to get wifi interface')) {

    logger.info(err.message + ". Autoconnect disengaged for now")
    stop_waiting();
  }
  else restart_reconnection();
}

var wait_normal_reconnection = () => {
  running = true;

  if (connected) return stop_waiting();
  logger.info("Device disconnected! Waiting for reconnection...");

  // Make sure Wi-Fi is on
  reconnect.enable_wifi((err) => {
    if (err) return check_err(err);
    timer = setTimeout(() => {
      logger.info("Nothing happened, let's try connecting to the nearest access points...");
      reconnect.get_ap_lists((err, list) => {
        if (err) return check_err(err);
        reconnect.try_connecting_to(list, (err, stdout) => {
          if (err) return check_err(err);
          return wait_normal_reconnection();
        });
      });
    }, reconnect_time)
  })
}

var stop_waiting = () => {
  running = false;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

exports.start = (opts, cb) => {
  hooks.on('connected', () => {
    connected = true;
    reconnect.is_connected(true);
    network.get_active_access_point((err, ap) => {
      if (was_disconnected) {
        logger.info("Connection achieved! " + (ap ? ap.ssid || "" : ""));
        was_disconnected = false;
      }
      reconnect.is_connected_to(ap);
    })
    stop_waiting();
  });

  hooks.on('disconnected', () => {
    reconnect.is_connected(false);
    was_disconnected = true;
    connected = false;
    if (config.get('auto_connect') && !sleeping) {
      wait_normal_reconnection();
    }
  });

  hooks.on('sleeping', (value) => {
    if (value) sleeping = true;
    else sleeping = false;

    reconnect.is_sleeping(value);

    // if just woke up and it's disconnected, start reconnection
    if (!sleeping && !connected && !running) {
      wait_normal_reconnection();
    }
  })

  emitter = new Emitter();
  cb(null, emitter);
}

exports.stop = () => {
  hooks.remove('connected');
  hooks.remove('disconnected');
  hooks.remove('sleeping');

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
}

exports.events = [];