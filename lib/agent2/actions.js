var logger  = require('./common').logger.prefix('actions'),
    hooks   = require('./hooks'),
    loader  = require('./loader'),
    actions = {};

var running = {};

var action_running = function(action, name, emitter) {
  logger.info('Running: ' + name)
  running[name] = action;

  emitter.once('stopped', function(err){
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
      hooks.trigger(event_name, data);
    })
  })
}

var action_stopped = function(name) {
  delete running[name];
}

actions.start = function(name, opts) {
  logger.info('Starting: ' + name);

  loader.load_action(name, function(err, action){
    if (err) return hooks.trigger('error', err);

    action.start(opts, function(err, emitter){
      if (err) {
        logger.info('Failed: ' + name + ' -> ' + err.message)
        hooks.trigger('error', err);
        return hooks.trigger('action', 'failed', name, err);
      }

      if (emitter) action_running(action, name, emitter);
    })
  })
}

actions.stop = function(name) {
  logger.info('Stopping action: ' + name);
  var action = running[name];

  if (action && action.stop)
    action.stop();
  else
    logger.info('Action not running or not stoppable.')
}

actions.stop_all = function() {
  for (var name in running)
    this.stop(name);
}



module.exports = actions;
