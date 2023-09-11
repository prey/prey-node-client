const { join } = require('path');
const logger = require('../common').logger.prefix('actions');
const hooks = require('./hooks');

const actions = {};
const running = {};

/**
 * Loads an action from a specified file.
 *
 * @param {string} type - The type of the action.
 * @param {string} name - The name of the action file.
 * @return {any} The loaded action.
 */
// eslint-disable-next-line consistent-return
const loadAction = (type, name) => {
  const file = join(__dirname, `${type}s`, name);
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(file);
  } catch (e) {
    hooks.trigger('error', e);
  }
};
/**
 * Deletes the specified ID from the running object.
 *
 * @param {type} id - The ID to be deleted.
 * @return {undefined} No return value.
 */
const actionStopped = (id) => {
  delete running[id];
};
/**
 * Watches the specified events and triggers corresponding hooks.
 *
 * @param {Array} events - The events to watch.
 * @param {EventEmitter} emitter - The event emitter to listen to.
 */
const watchActionEvents = (events, emitter) => {
  events.forEach((eventName) => {
    emitter.on(eventName, (data) => {
      hooks.trigger('event', eventName, data);
      hooks.trigger(eventName, data);
    });
  });
};

/**
 * Runs an action with the given parameters and sets up event listeners.
 *
 * @param {string} type - The type of action being run.
 * @param {number} id - The ID of the action being run.
 * @param {string} action - The action being run.
 * @param {string} name - The name of the action being run.
 * @param {object} opts - Additional options for the action.
 * @param {EventEmitter} emitter - The event emitter for the action.
 * @return {undefined}
 */
const actionRunning = (type, id, action, name, opts, emitter) => {
  logger.info(`Running: ${name} ${id}`);
  running[id] = { name, action };

  emitter.once('end', (idEmit, err, out) => {
    if (err) {
      hooks.trigger('error', err);
      logger.info(`Error: ${JSON.stringify(err)}`);
    }

    logger.info(`Stopped: ${name}`);
    actionStopped(idEmit);

    setTimeout(() => {
      hooks.trigger(type, 'stopped', idEmit, name, opts, err, out);
    }, 1000);

    if (action.events) { emitter.removeAllListeners(); }
  });

  if (!action.events) return;
  watchActionEvents(action.events, emitter);
};
/**
 * Starts the specified action with the given parameters.
 *
 * @param {string} type - The type of the action.
 * @param {string} id - The unique identifier of the action.
 * @param {string} name - The name of the action.
 * @param {object} opts - The options for the action.
 * @param {function} cb - The callback function.
 * @return {void}
 */
// eslint-disable-next-line consistent-return
const start = (type, id, name, opts, cb) => {
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

  const action = loadAction(type, name);
  // eslint-disable-next-line consistent-return
  if (!action) return; // loadAction will emit trigger

  action.type = type;
  action.options = typeof opts === 'function' ? {} : opts;

  // eslint-disable-next-line consistent-return
  action.start(id, opts, (err, emitter) => {
    if (!cb && typeof cb === 'function') cb(err);

    if (err) {
      logger.info(`Failed: ${name} -> ${err.message}`);
      if (type === 'action') {
        hooks.trigger('error', err);
        return hooks.trigger('action', 'failed', id, name, opts, err);
      }
      return hooks.trigger('error', err);
    }
    if (type === 'action') {
      setTimeout(() => {
        hooks.trigger(type, 'started', id, name, opts || {});
      }, 500);
    }
    if (emitter) {
      actionRunning(type, id, action, name, opts || {}, emitter);
    } else {
      // no emitter was returned, so we have no way of knowing when
      // this action will stop. given that the command watcher needs to know
      // when an action finished in order to update the list, we'll manually
      // trigger this event after 10 seconds.

      setTimeout(() => {
        hooks.trigger(type, 'stopped', id, name, opts || {});
      }, 10000);
    }
  });
};
/**
 * Start the action with the given ID, name, options, and callback.
 *
 * @param {type} id - The ID of the action.
 * @param {type} name - The name of the action.
 * @param {type} opts - The options for the action.
 * @param {type} cb - The callback function.
 * @return {type} The result of starting the action.
 */
actions.start = (id, name, opts, cb) => {
  start('action', id, name, opts, cb);
};
/**
 * Stop the specified action.
 *
 * @param {string} id - The identifier of the action to stop.
 * @param {string} name - The name of the action to stop.
 * @param {Object} opts - Additional options for stopping the action.
 */
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
    actionStopped(id);
  }
};
/**
 * Stops all running actions.
 *
 * @param {type} id - The ID of the action being stopped.
 * @return {type} The result of stopping the action.
 */
actions.stop_all = () => {
  running.forEach((id) => {
    this.stop(id);
  });
};

module.exports = actions;
