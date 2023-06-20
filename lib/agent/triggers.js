var fs = require('fs');
var join = require('path').join;
var hooks = require('./hooks');
var logger = require('./common').logger.prefix('triggers');
var watchers = [];
var events_list = {};
var running = {};
var triggers_list;
var triggers_path = join(__dirname, 'triggers');

var load_trigger = function (name) {
  try {
    return require(join(triggers_path, name));
  } catch (e) {
    hooks.trigger('error', e);
  }
};

exports.map = function (cb) {
  if (triggers_list) return cb(null, triggers_list);

  fs.readdir(triggers_path, function (err, files) {
    if (err) return cb(err);

    triggers_list = {};

    files.forEach(function (trigger_name) {
      if (trigger_name.match('README')) {
        return;
      }

      var module = load_trigger(join(triggers_path, trigger_name));
      if (!module) {
        return;
      }

      triggers_list[trigger_name] = module.events;

      module.events.forEach(function (evt) {
        events_list[evt] = trigger_name;
      });
    });

    cb(null, events_list);
  });
};

exports.add = function (trigger_name, opts) {
  start(trigger_name, opts, function (err) {
    if (!err) watchers.push(trigger_name);
  });
};

exports.remove = function (trigger_name) {
  stop(trigger_name);
};

exports.watch = function (list, cb) {
  if (!list || !list[0]) return cb && cb(new Error('Empty trigger list.'));

  logger.info('Watching: ' + list.join(', '));
  list.forEach(exports.add);
  cb && cb();
};

exports.unwatch = function () {
  watchers.forEach(exports.remove);
};

var trigger_running = function (type, trigger, name, opts, emitter) {
  logger.info('Running: ' + name);
  running[name] = trigger;

  emitter.once('end', function (err, out) {
    if (err) {
      hooks.trigger('error', err);
      logger.info('Error: ' + JSON.stringify(err));
    }

    logger.info(`Stopped: ${name}`);
    trigger_stopped(name);

    setTimeout(function () {
      hooks.trigger(type, 'stopped', name, opts, err, out);
    }, 1000);

    // bug!
    if (trigger.events) {
      logger.info('removing listeners: ' + JSON.stringify(trigger.events));
      emitter.removeAllListeners();
    }
  });

  if (!trigger.events) return;
  watch_triggers_events(trigger.events, emitter);
};

var start = function (name, opts, cb) {
  if (running[name]) {
    var err = new Error('Already running: ' + name);
    hooks.emit('error', err);
    return cb && cb(err);
  }

  logger.info('Starting trigger: ' + name);
  var trigger = load_trigger(name);
  if (!trigger) return; // load_action will emit trigger

  trigger.options = typeof opts == 'function' ? {} : opts; //revisar para q es

  trigger.start(opts, function (err, emitter) {
    cb && cb(err);

    if (err) {
      logger.info('Failed: ' + name + ' -> ' + err.message);
      return hooks.trigger('error', err);
    }

    if (!opts) opts = {};

    if (emitter) {
      trigger_running('trigger', trigger, name, opts, emitter);
    } else {
      // no emitter was returned, so we have no way of knowing when
      // this action will stop. given that the command watcher needs to know
      // when an action finished in order to update the list, we'll manually
      // trigger this event after 10 seconds.

      setTimeout(function () {
        // bug!
        hooks.trigger('action', 'stopped', name, opts);
      }, 10000);
    }
  });
};

var stop = function (name) {
  logger.info('Stopping: ' + name);
  var trigger = running[name];

  if (!trigger) {
    logger.warn('Trigger not running!');
    // hooks.trigger('action', 'stopped', name, opts);
  } else if (!trigger.stop) {
    logger.warn('Trigger not stoppable!');
  } else {
    trigger.stop();
  }
};

var trigger_stopped = function (name) {
  delete running[name];
};

var watch_triggers_events = function (events, emitter) {
  events.forEach(function (event_name) {
    emitter.on(event_name, function (data) {
      hooks.trigger('event', event_name, data);
      hooks.trigger(event_name, data);
    });
  });
};
