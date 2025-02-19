/* eslint-disable import/no-dynamic-require */
/* eslint-disable consistent-return */
const { join } = require('path');
const logger = require('./common').logger.prefix('actions');
const hooks = require('./hooks');

const actions = {};
const running = {};

const loadAction = (type, name) => {
  const file = join(__dirname, `${type}s`, name);
  try {
    // eslint-disable-next-line global-require
    return require(file);
  } catch (e) {
    hooks.trigger('error', e);
  }
};

const watchActionEvents = (events, emitter) => {
  events.forEach((eventName) => {
    emitter.on(eventName, (data) => {
      hooks.trigger('event', eventName, data);
      hooks.trigger(eventName, data);
    });
  });
};

const actionStopped = (id) => {
  delete running[id];
};

const actionRunning = (type, id, action, name, opts, emitter) => {
  logger.info(`Running: ${name} ${id}`);
  if (!action || !name) logger.info(`Error on actionRunning: ${name} -> ${action}`);
  running[id] = { name, action };

  emitter.once('end', (idEmitter, err, out) => {
    if (err) {
      hooks.trigger('error', err);
      logger.info(`Error: ${JSON.stringify(err)}`);
    }

    logger.info(`Stopped ${type}: ${name} ${id}`);
    actionStopped(idEmitter);

    setTimeout(() => {
      hooks.trigger(type, 'stopped', idEmitter, name, opts, err, out);
    }, 1000);

    if (action.events) emitter.removeAllListeners();
  });

  if (!action.events) return;
  watchActionEvents(action.events, emitter);
};

const start = (type, id, name, opts, cb) => {
  // Action with same id is not executed
  if (running[id]) {
    const err = new Error(`Already running: ${running[id].name} with id: ${id}`);
    hooks.emit('error', err);
    return cb?.(err);
  }

  if (Object.values(running).filter((x) => x.name === name).length > 0) {
    const err = new Error(`Already running: ${name} ${id}`);
    hooks.emit('error', err);
    return cb?.(err);
  }

  logger.info(`Starting ${type}: ${name} ${id}`);

  const action = loadAction(type, name);
  if (!action) return;

  action.type = type;
  action.options = typeof opts === 'function' ? {} : opts;

  // eslint-disable-next-line consistent-return
  action.start(id, opts, (err, emitter) => {
    if (cb) cb(err);

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
      actionRunning(type, id, action, name, options, emitter);
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

actions.stop = (id, name, opts) => {
  if (!Object.hasOwn(running, id)) {
    hooks.trigger('action', 'stopped', id, name, opts);
    return;
  }

  const { action } = running[id];

  try {
    if (!action) {
      logger.info(`Action ${running[id].name}, with id: ${id} not running!`);
      hooks.trigger('action', 'stopped', id, name, opts);
    } else if (!action.stop) {
      logger.info(`Action ${running[id].name}, with id: ${id} not stoppable!`);
    } else {
      logger.info(`Stopping: ${running[id].name}, with id: ${id}`);
      action.stop();
      actionStopped(id);
    }
  } catch (err) {
    logger.error(`Error stopping action ${id}: ${err}`);
  }
};

actions.stop_all = () => {
  Object.keys(running).forEach((id) => {
    if (Object.hasOwn(running, id)) {
      actions.stop(id);
    }
  });
};

module.exports = actions;
