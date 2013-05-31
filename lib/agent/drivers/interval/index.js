var needle  = require('needle'),
    common  = require('./../../common'),
    keys    = require('./../../keys'),
    hooks   = require('./../../hooks'),
    Emitter = require('events').EventEmitter;

var config  = common.config,
    helpers = common.helpers,
    logger  = common.logger.prefix('interval');

var timer,
    emitter,
    device_key,
    default_delay = 20 * 1000 * 60;

var get_url = function() {
  var host = config.get('protocol') + '://' + config.get('host');
  return host + '/api/v2/devices/' + device_key + '.json';
};

var request = function() {
  var opts = { parse: false },
      url  = get_url();

  logger.info('Sending request to ' + url);
  needle.get(url, function(err, resp, body){
    if (err || resp.statusCode != 200)
      return unload(err);

    emitter.emit('commands', body.toString())
  })
}

var queue_requests = function(delay) {
  logger.debug('Queueing requests every ' + delay + ' seconds.');

  // whenever we're woken, send a request
  hooks.on('woken', request);

  // set timer to check on intervals
  timer = setInterval(request, delay);

  // if run via cron, wait a few seconds before actually calling engage()
  var wait_secs = helpers.run_via_cron() ? helpers.random_between(1, 59) : 0;
  setTimeout(request, wait_secs);
}

var unload = function(err) {
  clearInterval(timer);
  emitter.emit('unload', err);
}

exports.load = function(opts, cb) {

  var opts  = opts || {},
      delay = opts.delay || default_delay;

  keys.verify(function(err){
    if (err) return cb(err);

    device_key = config.get('device_key');
    emitter    = new Emitter();

    queue_requests(delay);
    cb(null, emitter); // listeners get attached
  })

}

exports.unload = function(){
  unload();
}
