var logger  = require('./common').logger.prefix('actions'),
    hooks   = require('./hooks'),
    loader  = require('./loader'),
    actions = {};

var running = {};

var action_running = function(action, name, emitter) {
  logger.info('Running: ' + name)
  running[name] = action;

  emitter.once('end', function(err){
    if (err) hooks.trigger('error', err);

    logger.info('Stopped: ' + name)
    hooks.trigger('action', 'stopped', name, err);
    action_stopped(name);

    if (action.events)
      emitter.removeAllListeners();
  })

  if (!action.events) return;
  watch_action_events(action.events, emitter);
}

var watch_action_events = function(events, emitter) {
  events.forEach(function(event_name) {
    emitter.on(event_name, function(data){
      hooks.trigger('event', event_name, data);
      hooks.trigger(event_name, data);
    })
  })
}

var action_stopped = function(name) {
  delete running[name];
}

var start = function(type, name, opts, cb){
  if (running[name]) {
    var err = new Error('Already running: ' + name);
    hooks.emit('error', err);
    return cb && cb(err);
  }

  logger.info('Starting ' + type + ': '+ name);
  loader.load(type, name, function(err, action) {
    if (err) return hooks.trigger('error', err);

    action.type    = type;
    action.options = typeof opts == 'function' ? {} : opts;

    action.start(opts, function(err, emitter) {
      cb && cb(err);

      if (err) {
        logger.info('Failed: ' + name + ' -> ' + err.message)
        hooks.trigger('error', err);
        return hooks.trigger('action', 'failed', name, err);
      }

      if (type == 'action')
        hooks.trigger('action', 'started', name);

      if (emitter)
        action_running(action, name, emitter);
    })
  })
};

actions.start = function(name, opts) {
  start('action', name, opts);
}

actions.start_trigger = function(name, opts, cb) {
  start('trigger', name, opts, cb);
}

actions.stop = function(name) {
  logger.info('Stopping action: ' + name);
  var action = running[name];

  if (action && action.stop)
    action.stop();
  else
    logger.warn('Action not running or not stoppable.')
}

actions.stop_all = function() {
  for (var name in running)
    this.stop(name);
}

actions.running = function() {
  var list = [];
  for (var key in running) {
    if (running[key].type == 'action') {
      var obj = { name: key, options: running[key].options || {} }
      list.push(obj);
    }
  }
  return list;
}

module.exports = actions;
