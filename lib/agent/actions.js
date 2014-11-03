var join    = require('path').join,
    logger  = require('./common').logger.prefix('actions'),
    hooks   = require('./hooks');

var actions = {},
    running = {};

var actions_path = __dirname + '/actions';

var load_action = function(type, name) {
  var file = join(__dirname, type + 's', name);
  try {
    return require(file);
  } catch(e) {
    hooks.trigger('error', e);
  }
}

// type can be 'action' or 'trigger'
var action_running = function(type, action, name, emitter) {
  logger.info('Running: ' + name)
  running[name] = action;

  emitter.once('end', function(err, out) {
    if (err) hooks.trigger('error', err);

    logger.info('Stopped: ' + name);
    action_stopped(name);

    setTimeout(function() {
      hooks.trigger(type, 'stopped', name, err, out);
    }, 1000);

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
  var action = load_action(type, name);
  if (!action) return; // load_action will emit trigger

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
      hooks.trigger(type, 'started', name);

    if (emitter) {
      action_running(type, action, name, emitter);
    } else {

      // no emitter was returned, so we have no way of knowing when
      // this action will stop. given that the command watcher needs to know
      // when an action finished in order to update the list, we'll manually
      // trigger this event after 10 seconds.

      setTimeout(function() {
        hooks.trigger(type, 'stopped', name);
      }, 10000);

    }
  })

};

actions.start = function(name, opts) {
  start('action', name, opts);
}

actions.start_trigger = function(name, opts, cb) {
  start('trigger', name, opts, cb);
}

actions.stop = function(name) {
  logger.info('Stopping: ' + name);
  var action = running[name];

  if (!action) {
    logger.warn('Action not running!');
    hooks.trigger('action', 'stopped', name);
  } else if (!action.stop) {
    logger.warn('Action not stoppable!');
  } else {
    action.stop();
  }

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
