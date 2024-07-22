const fs = require('fs');
const { join } = require('path');
const hooks = require('./hooks');
const logger = require('./common').logger.prefix('triggers');

const watchers = [];
const eventsList = {};
const running = {};
let triggersList;
const triggersPath = join(__dirname, 'triggers');

// eslint-disable-next-line consistent-return
const loadTrigger = (name) => {
  try {
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(join(triggersPath, name));
  } catch (e) {
    hooks.trigger('error', e);
  }
};

// eslint-disable-next-line consistent-return
exports.map = (cb) => {
  if (triggersList) return cb(null, triggersList);

  // eslint-disable-next-line consistent-return
  fs.readdir(triggersPath, (err, files) => {
    if (err) return cb(err);

    triggersList = {};

    files.forEach((triggerName) => {
      if (triggerName.match('README')) {
        return;
      }

      const module = loadTrigger(join(triggersPath, triggerName));
      if (!module) {
        return;
      }

      triggersList[triggerName] = module.events;

      module.events.forEach((evt) => {
        eventsList[evt] = triggerName;
      });
    });

    cb(null, eventsList);
  });
};

const watchTriggersEvents = (events, emitter) => {
  events.forEach((eventName) => {
    emitter.on(eventName, (data) => {
      hooks.trigger('event', eventName, data);
      hooks.trigger(eventName, data);
    });
  });
};

const triggerStopped = (name) => {
  delete running[name];
};

const triggerRunning = (type, trigger, name, opts, emitter) => {
  logger.info(`Running: ${name}`);
  running[name] = trigger;

  emitter.once('end', (err, out) => {
    if (err) {
      hooks.trigger('error', err);
      logger.info(`Error: ${JSON.stringify(err)}`);
    }

    logger.info(`Stopped: ${name}`);
    triggerStopped(name);

    setTimeout(() => {
      hooks.trigger(type, 'stopped', name, opts, err, out);
    }, 1000);

    // bug!
    if (trigger.events) {
      logger.info(`removing listeners: ${JSON.stringify(trigger.events)}`);
      emitter.removeAllListeners();
    }
  });

  if (!trigger.events) return;
  watchTriggersEvents(trigger.events, emitter);
};

// eslint-disable-next-line consistent-return
const start = (name, options, cb) => {
  let opts = options;
  if (running[name]) {
    const err = new Error(`Already running: ${name}`);
    hooks.emit('error', err);
    return cb && cb(err);
  }

  logger.info(`Starting trigger: ${name}`);
  const trigger = loadTrigger(name);
  // eslint-disable-next-line consistent-return
  if (!trigger) return; // load_action will emit trigger

  trigger.options = typeof opts === 'function' ? {} : opts;

  // eslint-disable-next-line consistent-return
  trigger.start(opts, (err, emitter) => {
    if (typeof cb === 'function') cb(err);

    if (err) {
      logger.info(`Failed: ${name} -> ${err.message}`);
      return hooks.trigger('error', err);
    }

    if (!opts) opts = {};

    if (emitter) {
      triggerRunning('trigger', trigger, name, opts, emitter);
    } else {
      // no emitter was returned, so we have no way of knowing when
      // this action will stop. given that the command watcher needs to know
      // when an action finished in order to update the list, we'll manually
      // trigger this event after 10 seconds.

      setTimeout(() => {
        // bug!
        hooks.trigger('action', 'stopped', name, opts);
      }, 10000);
    }
  });
};

exports.add = (triggerName, opts) => {
  start(triggerName, opts, (err) => {
    if (!err) watchers.push(triggerName);
  });
};

const stop = (name, opts) => {
  logger.info(`Stopping: ${name}options: ${JSON.stringify(opts)}`);
  const trigger = running[name];

  if (!trigger) {
    logger.warn('Trigger not running!');
    // hooks.trigger('action', 'stopped', name, opts);
  } else if (!trigger.stop) {
    logger.warn('Trigger not stoppable!');
  } else {
    trigger.stop();
  }
};

exports.remove = (triggerName) => {
  stop(triggerName);
};

// eslint-disable-next-line consistent-return
exports.watch = (list, cb) => {
  if (!list || !list[0]) return cb && cb(new Error('Empty trigger list.'));

  logger.info(`Watching: ${list.join(', ')}`);
  list.forEach(exports.add);
  if (typeof cb === 'function') cb();
};

exports.unwatch = () => {
  watchers.forEach(exports.remove);
};
