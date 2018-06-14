var join = require('path').join,
    base_path = join(__dirname, '..', '..'),
    hooks = require(join(base_path, 'hooks')),
    network = require(join(base_path, 'providers', 'network')),
    common = require('./../../common'),
    config = common.config,
    Emitter = require('events').EventEmitter;

var emitter,
    status = null, // either connected or disconnected
    internet_status = null,
    checking = false,
    interval_checker;

var args = {
  proxy:    config.get('try_proxy'),
  protocol: config.get('control-panel').protocol,
  host:     config.get('control-panel').host
};

var args_net = {
  proxy:    args.proxy,
  protocol: args.protocol,
  host:     'www.google.com'
};

var check = function(opts, cb) {

  if (checking) return;
  checking = true;

  network.get_connection_status(opts, function(new_status) {
    var current_status = status;

    if (opts.host == 'www.google.com') {
      current_status  = internet_status;
      new_status      = new_status.concat('_internet');
      internet_status = new_status;
    } else {
      status = new_status;
    }

    if (current_status != new_status) {
      // trigger directly the event instead of emitting it to the actions manager
      hooks.trigger(new_status);
    }

    checking = false;
    if (cb) return cb();
  });
}

var check_status = function() {
  check(args, function() {
    if (status == 'disconnected') check(args_net);
  })
}

exports.start = function(opts, cb) {
  check_status();
  hooks.on('network_state_changed', check_status);

  hooks.on('connected', function() {
    if (internet_status != 'connected_internet') {
      internet_status = 'connected_internet';
      hooks.trigger(internet_status);
    }
  });

  hooks.on('disconnected_internet', function() {
    network.reset_active_access_point();
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
  hooks.remove('disconnected_internet');
  hooks.remove('connected');

  clearInterval(interval_checker);
  interval_checker = null;
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
