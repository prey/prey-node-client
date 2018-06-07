var join = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks = require(join(base_path, 'hooks')),
    network = require(join(base_path, 'providers', 'network')),
    file_retrieval = require(join(base_path, 'actions', 'fileretrieval')),
    actions = require('./../../actions'),
    commands = require('./../../commands'),
    common = require('./../../common'),
    config = common.config,
    Emitter = require('events').EventEmitter;

var emitter,
    status, // either connected or disconnected
    internet_status,
    checking = false,
    checking_internet = false,
    interval_checker,
    interval_checker_net;

var args = {
  proxy:    config.get('try_proxy'),
  protocol: config.get('control-panel').protocol,
  host:     config.get('control-panel').host,
}

var check_status = function() {
  if (checking) return;
  checking = true;

  network.get_connection_status(args, function(new_status) {

    if (status != new_status) {
      // trigger directly the event instead of emitting it to the actions manager
      hooks.trigger(new_status);
    }

    status = new_status;
    checking = false;
  });
}

var check_internet_status = function() {
  if (checking_internet) return;
  checking_internet = true;

  var args_net = args;
  args_net.host = 'www.google.com'
  network.get_connection_status(args_net, function(new_status) {

    if (internet_status != new_status) {
      hooks.trigger(new_status.concat('_internet'));
    }

    internet_status = new_status;
    checking_internet = false;
  });
}

exports.start = function(opts, cb) {
  check_status();
  hooks.on('network_state_changed', check_status);

  hooks.on('connected', function() {
    if (interval_checker_net) {
      clearInterval(interval_checker_net);
      interval_checker_net = null;
    }
    // Check internet status one more time
    check_internet_status();
  });

  hooks.on('disconnected', function() {
    check_internet_status();
    interval_checker_net = setInterval(function() {
      check_internet_status();
    }, 15000);
  });

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
  clearInterval(interval_checker);
  clearInterval(interval_checker_net);
  interval_checker = null;
  interval_checker_net = null;
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
