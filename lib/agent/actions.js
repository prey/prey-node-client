const { join } = require('path');
const logger = require('./common').logger.prefix('actions');
const hooks = require('./hooks');

const actions = {};
const running = {};

const load_action = (type, name) => {
  const file = join(__dirname, `${type}s`, name);
  try {
    return require(file);
  } catch (e) {
    hooks.trigger('error', e);
  }
};

const watch_action_events = (events, emitter) => {
  events.forEach((eventName) => {
    emitter.on(eventName, (data) => {
      hooks.trigger('event', eventName, data);
      hooks.trigger(eventName, data);
    });
  });
};
// type can be 'action' or 'trigger'
const action_running = (type, id, action, name, opts, emitter) => {
  logger.info(`Running: ${name} ${id}`);
  running[id] = { name, action };

  emitter.once('end', (idEmitter, err, out) => {
    if (err) {
      hooks.trigger('error', err);
      logger.info(`Error: ${JSON.stringify(err)}`);
    }

    logger.info(`Stopped: ${name}`);
    action_stopped(idEmitter);

    setTimeout(() => {
      hooks.trigger(type, 'stopped', idEmitter, name, opts, err, out);
    }, 1000);

    if (action.events) emitter.removeAllListeners();
  });

  if (!action.events) return;
  watch_action_events(action.events, emitter);
};

const action_stopped = (id) => {
  delete running[id];
};

const start = function (type, id, name, opts, cb) {
  // Action with same id is not executed
  if (running[id]) {
    const err = new Error(`Already running: ${running[id].name} with id: ${id}`);
    hooks.emit('error', err);

    return cb && cb(err);
  }

  if (Object.values(running).filter((x) => x.name === name).length > 0) {
    const err = new Error(`Already running: ${name}`);
    hooks.emit('error', err);
    return cb && cb(err);
  }

  logger.info(`Starting ${type}: ${name}`);

  const action = load_action(type, name);
  if (!action) return; // load_action will emit trigger

  action.type = type;
  action.options = typeof opts === 'function' ? {} : opts;

  // eslint-disable-next-line consistent-return
  action.start(id, opts, (err, emitter) => {
    cb && cb(err);

    if (err) {
      logger.info(`Failed: ${name} -> ${err.message}`);
      if (type === 'action') {
        hooks.trigger('error', err);
        return hooks.trigger('action', 'failed', id, name, opts, err);
      }
      return hooks.trigger('error', err);
    }
    let options = opts;
    if (!opts) options = {};

    if (type === 'action') {
      setTimeout(() => {
        hooks.trigger(type, 'started', id, name, options);
      }, 500);
    }
    if (emitter) {
      action_running(type, id, action, name, options, emitter);
    } else {
      // no emitter was returned, so we have no way of knowing when
      // this action will stop. given that the command watcher needs to know
      // when an action finished in order to update the list, we'll manually
      // trigger this event after 10 seconds.

      setTimeout(() => {
        hooks.trigger(type, 'stopped', id, name, options);
      }, 10000);
    }
  });
};

actions.start = (id, name, opts, cb) => {
  start('action', id, name, opts, cb);
};

// TODO: agregar lo del opts para el response
actions.stop = (id, name, opts) => {
  if (!running[id]) {
    hooks.trigger('action', 'stopped', id, name, opts);
    return;
  }

  const { action } = running[id];

  if (!action) {
    logger.warn('Action not running!');
    hooks.trigger('action', 'stopped', id, name, opts);
  } else if (!action.stop) {
    logger.warn('Action not stoppable!');
  } else {
    logger.info(`Stopping: ${running[id].name}, with id: ${id}`);
    action.stop();
    action_stopped(id);
  }
};

actions.stop_all = function () {
  for (const id in running) {
    actions.stop(id);
  };
};

module.exports = actions;
