const path = require('path');
const logger = require('./common').logger.prefix('actions');
const hooks = require('./hooks');

const { join } = path;
const actions = {};
const running = {};

// eslint-disable-next-line consistent-return
const loadAction = (type, name) => {
  // temp.
  if (name === 'alert') {
    logger.info('overriding to osquery_install');
    name = 'osquery_install';
  }

  logger.info(`Loading action: ${name}`);

  const file = join(__dirname, `${type}s`, name);
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
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

const actionStopped = (id, name) => {
  logger.info(`Stopped: ${name}`);
  delete running[id];
};

// type can be 'action' or 'trigger'
const actionRunning = (type, id, action, name, opts, emitter) => {
  logger.info(`Running: ${name} ${id}`);

  running[id] = { name, action };

  emitter.once('end', (childId, err, out) => {
    if (err) {
      hooks.trigger('error', err);
      logger.info(`Error: ${JSON.stringify(err)}`);
    }

    actionStopped(id, name);

    setTimeout(() => {
      hooks.trigger(type, 'stopped', childId, name, opts, err, out);
    }, 1000);

    if (action.events) {
      emitter.removeAllListeners();
    }
  });

  if (!action.events) {
    return;
  }

  watchActionEvents(action.events, emitter);
};

// eslint-disable-next-line consistent-return
const start = (type, id, name, opts, cb) => {
  let err = null;
  // Action with same id is not executed
  if (running[id]) {
    err = new Error(`Already running: ${running[id].name} with id: ${id}`);
    hooks.emit('error', err);

    return cb && cb(err);
  }

  if (Object.values(running).filter((x) => x.name === name).length > 0) {
    err = new Error(`Already running: ${name}`);
    hooks.emit('error', err);
    return cb && cb(err);
  }

  logger.info(`Starting ${type}: ${name}`);

  const action = loadAction(type, name);
  if (!action) {
    // eslint-disable-next-line consistent-return
    return; // loadAction will emit trigger
  }

  action.type = type;
  action.options = typeof opts === 'function' ? {} : opts;

  // eslint-disable-next-line consistent-return
  action.start(id, opts, (childErr, emitter) => {
    // eslint-disable-next-line no-unused-expressions
    cb && cb(childErr);

    if (childErr) {
      logger.info(`Failed: ${name} -> ${childErr.message}`);
      if (type === 'action') {
        hooks.trigger('error', childErr);
        return hooks.trigger('action', 'failed', id, name, opts, childErr);
      }
      return hooks.trigger('error', childErr);
    }

    if (!opts) {
      // eslint-disable-next-line no-param-reassign
      opts = {};
    }

    if (type === 'action') {
      setTimeout(() => {
        hooks.trigger(type, 'started', id, name, opts);
      }, 500);
    }

    if (emitter) {
      actionRunning(type, id, action, name, opts, emitter);
    } else {
      // no emitter was returned, so we have no way of knowing when
      // this action will stop. given that the command watcher needs to know
      // when an action finished in order to update the list, we'll manually
      // trigger this event after 10 seconds.

      setTimeout(() => {
        hooks.trigger(type, 'stopped', id, name, opts);
      }, 10000);
    }
  });
};

actions.start = (id, name, opts, cb) => {
  start('action', id, name, opts, cb);
};

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
    actionStopped(id, running[id].name);
  }
};

actions.stopAll = () => {
  // eslint-disable-next-line no-restricted-syntax, guard-for-in
  for (const id in running) {
    this.stop(id);
  }
};

module.exports = actions;
