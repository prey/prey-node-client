var agent,
    getter,
    loaded;

var timer,
    emitter,
    current_delay,
    default_delay = 20 * 1000 * 60, // 20 min
    short_delay   = 0.5  * 1000 * 60; //  30 secs

var parse_cmd = function(str) {
  try {
    return JSON.parse(str);
  } catch(e) {
    // 
  }
}

var request = function() {
  getter(function(err, resp, body) {
    if (err)
      return agent.hooks.trigger('error', err, 'interval');
    else if (resp.statusCode != 200)
      return agent.hooks.trigger('error', new Error('Invalid response received: ' + resp.statusCode));

    if (body.length && body.length > 0)
      agent.logger.warn('Got ' + body.length + ' commands.');

    body.forEach(function(el) {
      var cmd = el.target ? el : parse_cmd(el);
      agent.hooks.trigger('command', cmd);
    })
  })
}

var load_hooks = function() {
  // whenever we're woken or device connects, send a request
  agent.hooks.on('woken', request);
  agent.hooks.on('connected', request);

  // whenever reachable state changes, hasten or slowen
  agent.hooks.on('reachable', set_interval);
  agent.hooks.on('unreachable', set_faster_interval);

  loaded = true;
}

// set timer to check on intervals
var set_interval = function(delay) {
  if (!loaded) return;
  if (!delay) delay = default_delay;

  if (delay == current_delay) return;
  current_delay = delay;

  agent.logger.info('Queueing check-ins every ' + delay/60000 + ' minutes.');
  if (timer) clearInterval(timer);
  timer = setInterval(request, delay);
}

var set_faster_interval = function() {
  set_interval(short_delay);
}

var unload = function(err) {
  if (err)
    agent.logger.error('Failed, unloading: ' + err.message);

  agent.hooks.remove('woken', request);
  agent.hooks.remove('connected', request);
  if (timer) clearInterval(timer);

  loaded = false;
}

exports.load = function(common, cb) {
  agent   = common;
  getter  = agent.api.devices.get.commands;

  load_hooks();
  set_interval();
  // request();
}

exports.unload = function(){
  unload();
}
