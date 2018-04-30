var join      = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks     = require(join(base_path, 'hooks')),
    // logger    = require('./../../common').logger.prefix('reconnect'),
    reconnect   = require('./reconnect'),
    network   = require('./../../providers/network');

var timer = null,
    timer2 = null;

var connected = false;

var wait_normal_reconnection = function() {
  console.log("Device disconnected, waiting for reconnection: 10s");
  timer = setTimeout(function() {
    reconnect.get_open_ap_list(function(err, list) {
      if (err) wait_normal_reconnection();
      else reconnect.try_connecting_to(list);
    });
  }, 10000)
}

var stop_waiting = function() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

exports.load = function() {
  agent = this;
  console.log("AGENT")
  agent.hooks.on('connected', function() {
    console.log("CONNECTED!!!!!")
    network.get_active_access_point(function(err, ap) {
      reconnect.connected(ap);
    })
    stop_waiting();
  });

  agent.hooks.on('disconnected', function() {
    console.log("DISCONNECTED!!!")
    reconnect.connected(null);
    wait_normal_reconnection();
  });
}

exports.unload = function() {
  agent.hooks.remove('connected');
  agent.hooks.remove('disconnected');
}
