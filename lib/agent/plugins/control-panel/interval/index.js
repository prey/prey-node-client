var bus     = require('../bus'),
    api     = require('./../api'),
    getter  = api.devices.get,
    Emitter = require('events').EventEmitter;

var hooks,
    logger,
    loaded;

var timer,
    emitter,
    requesting,
    long_delay = 20 * 1000 * 60, // 20 min
    short_delay   = 0.5  * 1000 * 60, //  30 secs
    current_delay = long_delay;

var parse_cmd = function(str) {
  try {
    return JSON.parse(str);
  } catch(e) {
    if (hooks)
      hooks.trigger('error', new Error('Invalid command: ' + str));
  }
};

var request = function(re_schedule) {
  if (requesting)
    return;

  requesting = true;
  logger.debug('Fetching instructions...');
  getter.commands(function(err, resp) {
    requesting = false;

    if(re_schedule) {
      logger.debug('Re-scheduling request.');
      schedule_request();
    }

    if (err)
      return hooks.trigger('error', err, 'interval');
    else if (resp.statusCode != 200)
      return hooks.trigger('error', new Error('Invalid response received: ' + resp.statusCode));
    else if (!resp.body.forEach)
      return hooks.trigger('error', new Error('Invalid commands object: ' + resp.body.toString()));

    if (resp.body.length && resp.body.length > 0)
      logger.warn('Got ' + resp.body.length + ' commands.');

    resp.body.forEach(function(el) {
      var cmd = el.target ? el : parse_cmd(el);
      if (cmd) emitter.emit('command', cmd);
    });

  });
};

var set_slower_interval = function () {
  set_interval(long_delay);
};

var set_faster_interval = function() {
  set_interval(short_delay);
};

// set timer to check on intervals
var set_interval = function(delay) {
  current_delay = delay;

  logger.info('Queuing check-ins every ' + delay/60000 + ' minutes.');
  if (timer) {
    logger.debug('Clearing previous request schedule.');
    clearTimeout(timer);
    schedule_request();
  }
};

var schedule_request = function (custom_delay) {
  var delay = custom_delay || current_delay,
      re_schedule = true;
  timer = setTimeout(request, delay, re_schedule);
};

var load_hooks = function() {
  // whenever device connects, send a request
  hooks.on('connected', request);

  // whenever reachable state changes, hasten or slowen
  bus.on('reachable', set_slower_interval);
  bus.on('unreachable', set_faster_interval);

  loaded = true;
};

var unload = function(err) {
  if (err)
    logger.error('Failed, unloading: ' + err.message);

  hooks.remove('connected', request);

  bus.removeAllListeners();

  if (timer) clearTimeout(timer);

  loaded = false;

  if (emitter) {
    emitter.removeAllListeners();
    emitter = null;
  }
};

exports.check = function() {
  request();
};

exports.load = function(cb) {
  if (emitter)
    return cb(null, emitter);

  var common = this;
  hooks  = common.hooks;
  logger = common.logger;

  load_hooks();
  schedule_request(3000); // wait a bit and fire request

  emitter = new Emitter();
  cb(null, emitter);
};

exports.unload = function() {
  if (!hooks) return; // not loaded yet.
  unload();
};
