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
var action_running = function(type, id, action, name, opts, emitter) {
  logger.info('Running: ' + name + ' ' + id);
  running[id] = {name: name, action: action};

  emitter.once('end', function(id, err, out) {
    if (err) hooks.trigger('error', err);

    logger.info('Stopped: ' + name);
    action_stopped(id);

    setTimeout(function() {
      hooks.trigger(type, 'stopped', id, name, opts, err, out);
    }, 1000);

    if (action.events)
      emitter.removeAllListeners();
  })

  if (!action.events) return;
  watch_action_events(action.events, emitter);
}

// revisar q hace esta funcion!
var watch_action_events = function(events, emitter) {
  events.forEach(function(event_name) {
    emitter.on(event_name, function(data){
      hooks.trigger('event', event_name, data);
      hooks.trigger(event_name, data);
    })
  })
}

var action_stopped = function(id) {
  delete running[id];
}

var start = function(type, id, name, opts, cb){
  // Action with same id is not executed
  if (running[id]) {
    // var err = new Error('Already running: ' + name);
    var err = new Error(`Already running: ${running[id].name} with id: ${id}`);
    hooks.emit('error', err);

    return cb && cb(err);
  }

  if (Object.values(running).filter(x => x.name == name).length > 0) {
    var err = new Error(`Already running: ${name}`);
    hooks.emit('error', err);
    return cb && cb(err);
  }

  logger.info('Starting ' + type + ': '+ name);

  var action = load_action(type, name);
  if (!action) return; // load_action will emit trigger

  action.type    = type;
  action.options = typeof opts == 'function' ? {} : opts;

  action.start(id, opts, function(err, emitter) {
    cb && cb(err);

    if (err) {
      logger.info('Failed: ' + name + ' -> ' + err.message)
      if (type == 'action') {
        hooks.trigger('error', err);
        return hooks.trigger('action', 'failed', name, err);
      }
      return hooks.trigger('error', err);
    }

    if (!opts) opts = {};

    if (type == 'action')
      hooks.trigger(type, 'started', id, name, opts);

    if (emitter) {
      action_running(type, id, action, name, opts, emitter);
    } else {

      // no emitter was returned, so we have no way of knowing when
      // this action will stop. given that the command watcher needs to know
      // when an action finished in order to update the list, we'll manually
      // trigger this event after 10 seconds.

      setTimeout(function() {
        hooks.trigger(type, 'stopped', id, name, opts);
      }, 10000);

    }
  })

};

actions.start = function(id, name, opts, cb) {
  start('action', id, name, opts, cb);
}

// agregar lo del opts para el response
actions.stop = function(id) {
  if (!running[id]) {
    hooks.trigger('action', 'stopped', id);
  }

  var action = running[id].action;

  if (!action) {
    logger.warn('Action not running!');
    hooks.trigger('action', 'stopped', id);   // name por id
  } else if (!action.stop) {
    logger.warn('Action not stoppable!');
  } else {
    logger.info(`Stopping: ${running[id].name}, with id: ${id}`);
    action.stop();
    action_stopped(id);
  }
}

// revisar q esto siga funcionando!
actions.stop_all = function() {
  console.log("STOP ALL!!!")
  for (var name in running)
    this.stop(name);
}

// esta tb
actions.running = function() {
  console.log("RUNNING")
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
