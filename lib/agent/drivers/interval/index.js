var needle  = require('needle'),
    common  = require('./../../common'),
    keys    = require('./../../keys'),
    hooks   = require('./../../hooks'),
    Emitter = require('events').EventEmitter;

var config  = common.config,
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
  var url  = get_url(),
      opts = { username: config.get('api_key'), password: 'x' };

  logger.info('Sending request to ' + url.replace(/.*\/\/([^\/]+).*/, '$1'));

  needle.get(url, function(err, resp, body){
    if (err)
      return hooks.trigger('error', err, 'interval');
    else if (resp.statusCode != 200)
      return unload(new Error('Invalid response received: ' + resp.statusCode));

    if (body != '[]')
      emitter.emit('message', body.toString())
  })
}

var queue_requests = function(delay) {
  logger.debug('Queueing requests every ' + delay/1000 + ' seconds.');

  // whenever we're woken or device connects, send a request
  hooks.on('woken', request);
  hooks.on('connected', request);

  // set timer to check on intervals
  timer = setInterval(request, delay);
}

var unload = function(err) {
  if (err) 
    logger.error('Failed, unloading : ' + err.message);

  clearInterval(timer);
  emitter.emit('unload', err);
}

exports.load = function(opts, cb) {

  var opts  = opts || {},
      delay = opts.delay || default_delay;

  keys.verify(function(err, linked){
    if (err) return cb(err);

    device_key = config.get('device_key');
    emitter    = new Emitter();

    queue_requests(delay);
    if (linked) request(); // if just linked, make a request right away

    cb(null, emitter); // listeners get attached
  })

}

exports.unload = function(){
  unload();
}
