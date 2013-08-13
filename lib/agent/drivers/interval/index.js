var needle  = require('needle'),
    common  = require('./../../common'),
    config  = common.config,
    hooks   = require('./../../hooks'),
    Emitter = require('events').EventEmitter;

var pull    = common.api.pull,
    logger  = common.logger.prefix('interval');

var timer,
    emitter,
    current_delay,
    default_delay = 20 * 1000 * 60,
    short_delay   = 2  * 1000 * 60;


var request = function() {
  pull.commands(function(err, resp, body){
    if (err)
      return hooks.trigger('error', err, 'interval');
    else if (resp.statusCode != 200)
      return unload(new Error('Invalid response received: ' + resp.statusCode));

    if (body != '[]')
      emitter.emit('message', body.toString())
  })
}

var load_hooks = function() {
  // whenever we're woken or device connects, send a request
  hooks.on('woken', request);
  hooks.on('connected', request);

  // whenever reachable state changes, hasten or slowen
  hooks.on('reachable', set_interval);
  hooks.on('unreachable', set_faster_interval);
}

// set timer to check on intervals
var set_interval = function(delay) {
  if (!delay) delay = default_delay;

  if (delay == current_delay) return;
  current_delay = delay;

  logger.debug('Queueing check-ins every ' + delay/60000 + ' minutes.');
  if (timer) clearInterval(timer);
  timer = setInterval(request, delay);
}

var set_faster_interval = function() {
  set_interval(short_delay);
}

var unload = function(err) {
  if (err)
    logger.error('Failed, unloading : ' + err.message);

  hooks.remove('woken', request);
  hooks.remove('connected', request);
  if (timer) clearInterval(timer);

  emitter.emit('unload', err);
}

exports.load = function(opts, cb) {

  var opts  = opts || {},
      delay = opts.delay; // if null, defaults to default_delay

  common.setup(common, function(err, linked){
    if (err) return cb(err);

    device_key = config.get('device_key');
    emitter    = new Emitter();

    load_hooks();
    set_interval(delay);

    if (linked) request(); // if just linked, make a request right away

    cb(null, emitter); // listeners get attached
  })

}

exports.unload = function(){
  unload();
}
