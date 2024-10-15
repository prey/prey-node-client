const common = require('./common');
const hooks = require('./hooks');
const actions = require('./actions');
const triggers = require('./triggers');
const providers = require('./providers');
const reports = require('./reports');
const updater = require('./updater');
const storage = require('./utils/storage');
const devices = require('./control-panel/api/devices');

const logger = common.logger.prefix('commands');
let watching = false; // flag for storing new commands when fired
let id;

const { v4: uuidv4 } = require('uuid');

const actions_not_allowed = ['user_activated'];
/// /////////////////////////////////////////////////////////////////
// helpers

// transforms this 'host:myhost.com user:god'
// into this: {host: 'myhost.com', user: 'god' }
const parse_arguments = function (args) {
  if (!args || args.trim() === '') return;
  try {
    const formatted = args
      .trim()
      .replace(/([\w\.]+)/g, '"$1"')
      .replace(/" /g, '",');
    return JSON.parse(`{${formatted}}`);
  } catch (e) {
    console.log('Invalid argument format.');
  }
};

const handle_error = function (err) {
  hooks.trigger('error', err);
};
/// /////////////////////////////////////////////////////////////////
// build/run/parse/perform/process exports

exports.build = function build(command, target, options) {
  const obj = { command, target };
  if (options) obj.options = options;
  return obj;
};

exports.run = function (command, target, options) {
  const obj = exports.build(command, target, options);
  if (obj) exports.perform(obj);
};

exports.parse = function (body) {
  let c;
  let matches;

  if ((matches = body.match(/^help\s?(\w+)?/))) c = ['help', matches[1]];

  // on [event] [start|stop] [something]
  if (
    (matches = body.match(
      /^(on|once) ([\w\-]+) (config|start|stop|get|set|send) (.+)/,
    ))
  ) c = ['hook', matches[1], matches[2], body];

  if ((matches = body.match(/^config read ([\w-]+)/))) c = ['config', [matches[1]]];

  if ((matches = body.match(/^config update (\w+)\s(?:to )?(\w+)/))) c = ['command', this.build('update', matches[1], matches[2])];

  if ((matches = body.match(/^upgrade/))) c = ['command', this.build('upgrade')];

  if ((matches = body.match(/^start ([\w\-]+)(?: (using|with) )?(.*)/))) {
    c = [
      'command',
      this.build('start', matches[1], parse_arguments(matches[3])),
    ];
  }

  if ((matches = body.match(/^watch ([\w\-]+)(?: (using|with) )?(.*)/))) {
    c = [
      'command',
      this.build('watch', matches[1], parse_arguments(matches[3])),
    ];
  }

  if ((matches = body.match(/^stop ([\w\-]+)/))) c = ['command', this.build('stop', matches[1])];

  if ((matches = body.match(/^unwatch ([\w\-]+)/))) c = ['command', this.build('unwatch', matches[1])];

  if (
    (matches = body.match(
      /^(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(?: (using|with) )?(.*)/,
    ))
  ) {
    // var destination = matches[2] ? [matches[1].trim(), matches[2].trim(), matches[3]] : {};
    if (matches[1][0] == '/' && matches[1].match(/\.(...?)/)) c = ['send_file', [matches[1].trim()]];
    else if (matches[1]) c = ['command', this.build('get', matches[1].trim())];
  }

  return c;
};

exports.perform = function (command) {
  if (!command) return handle_error(new Error('No command received'));

  if (typeof command.options === 'string') {
    try {
      command.options = JSON.parse(command.options);
    } catch (e) {
      logger.warn(`Error parsing command options: ${e.message}`);
    }
  }

  // verify if id comes as part of the message.
  // if it's not present is created using uuidv4
  if (command.id) {
    id = command.id;
  } else if (command.options && command.options.messageID) {
    id = command.options.messageID;
  } else {
    id = uuidv4();
  }

  if (command.body) {
    command = command.body;
  }

  logger.info(`Command received: ${JSON.stringify(command)}`);

  const methods = {
    start: actions.start,
    stop: actions.stop,
    watch: triggers.add,
    unwatch: actions.stop,
    get: providers.get,
    report: reports.get,
    cancel: reports.cancel,
    upgrade: updater.check,
  };

  // Intercept {command: 'get', target: 'report', options: {interval: 5}}
  // This kind of report should be storable. To ensure it can be stored we need
  // to change it to {command: 'report', target: 'stolen'}
  if (
    command.command === 'get'
    && command.target === 'report'
    && command.options.interval
  ) {
    command.command = 'report';
    command.target = 'stolen';
  }

  // Automation command to mark as missing and recovered from here
  if (
    command.command === 'start'
    && (command.target === 'missing' || command.target === 'recover')
  ) {
    const set_missing = command.target === 'missing';

    // Set as missing or recovered on the control panel
    devices.post_missing(set_missing, (err) => {
      if (err) {
        logger.warn(
          `Unable to set missing state to the device: ${err.message}`,
        );
      }
    });

    // Initialize (or end) reports process on the client
    const is_stolen = reports.running().some((e) => e.name == 'stolen');
    if (set_missing && !is_stolen) {
      command.command = 'report';
      command.target = 'stolen';
    } else {
      command.command = 'cancel';
      command.target = 'stolen';
    }
  }

  const type = command.command || command.name;
  const method = methods[type];

  if (method && !actions_not_allowed.find((x) => x == command.target)) {
    hooks.trigger('command', method, command.target, command.options);

    if (command.command != 'start') {
      if (
        command.command == 'get'
        || command.command == 'report'
        || command.command == 'cancel'
      ) {
        if (command.command == 'cancel' && command.target == 'stolen') {
          delete_same_target(id, 'stolen', () => {
            logger.debug('Deleted report stored command');
          });
        }
        method(command.target, command.options);
      } else {
        method(id, command.target, command.options);
      }
    } else {
      verify_if_executed(id, (err, executed, idOverall) => {
        // Was executed and finished
        if (!executed) {
          const target = verify_if_is_full_wipe(command.target, 'fullwipe');
          command.options.target = command.target;
          command.target = target;
          method(idOverall, command.target, command.options);
        } else {
          logger.warn(`Action with id ${idOverall} was already executed`);
        }
      });
    }

    update_stored(type, id, command.target, command.options);
  } else {
    handle_error(
      new Error(`Unknown command: ${command.command || command.name}`),
    );
  }
};

exports.process = function (str) {
  try {
    var commands = JSON.parse(str);
    logger.info('Got commands.');
  } catch (e) {
    return handle_error(new Error(`Invalid commands: ${str}`));
  }

  commands.forEach(this.perform);
};

/// /////////////////////////////////////////////////////////////////
// command persistence
exports.store = store;

// When storing an action it gets deleted only when an action with the same name arrives.
var delete_same_target = (id, target, cb) => {
  storage.do(
    'query',
    { type: 'commands', column: 'target', data: target },
    (err, actions) => {
      if (actions && actions.length == 0) return cb();
      actions.forEach((action, index) => {
        if (id != action.id) {
          storage.do('del', { type: 'commands', id: action.id }, () => {
            if (index == actions.length - 1) return cb();
          });
        } else if (index == actions.length - 1) return cb();
      });
    },
  );
};

var store = function (type, id, name, opts, cb) {
  logger.debug(`Storing command in DB: ${[type, name].join('-')}`);

  delete_same_target(id, name, () => {
    if (name == 'geofencing' || name == 'triggers' || name == 'fileretrieval') return cb && cb();
    storage.do(
      'set',
      {
        type: 'commands',
        id,
        data: { command: type, target: name, options: opts },
      },
      cb,
    );
  });
};

const remove = function (type, id, name, cb) {
  logger.debug(`Removing command from DB: ${[type, name].join('-')}`);
  storage.do('del', { type: 'commands', id }, cb);
};

var verify_if_executed = function (id, cb) {
  storage.do(
    'query',
    { type: 'commands', column: 'id', data: id },
    (err, rows) => {
      if (err) {
        return cb(err, null, id);
      }

      if ((rows && rows.length == 0) || (rows[0] && rows[0].stopped == 'NULL')) {
        return cb(null, false, id);
      }
      return cb(null, true, id);
    },
  );
};

var verify_if_is_full_wipe = function (target, word) {
  const result = target.split(word);
  if (result && result.length == 2 && result[1] == 'windows') return word;
  return target;
};

// record when actions, triggers and reports are started
var update_stored = function (type, id, name, opts) {
  if (!watching) return;

  const storable = ['start', 'watch', 'report'];

  if (type == 'cancel')
  // report cancelled
  { remove('report', id, name); } else if (storable.indexOf(type) !== -1) {
    store(type, id, name, opts);
  }
};

// listen for new commands and add them to storage, in case the app crashes
const watch_stopped = function () {
  if (!watching) return;

  hooks.on('action', (event, id) => {
    if (event == 'stopped' || event == 'failed') {
      storage.do(
        'update',
        {
          type: 'commands',
          id,
          columns: 'stopped',
          values: new Date().toISOString(),
        },
        (err) => {
          if (err) {
            logger.warn(
              `Unable to update stopped action timestamp for id:${id}`,
            );
          }
        },
      );
    }

    if (event == 'started') {
      storage.do(
        'update',
        {
          type: 'commands',
          id,
          columns: 'started',
          values: new Date().toISOString(),
        },
        (err) => {
          if (err) {
            logger.warn(
              `Unable to update started action timestamp for id:${id}`,
            );
          }
        },
      );
    }
  });

  hooks.on('trigger', (event, name) => {
    if (event == 'stopped') remove('watch', name);
  });
};

exports.start_watching = function () {
  watching = true;
  watch_stopped();
};

exports.stop_watching = function () {
  watching = false;
};

exports.run_stored = function (cb) {
  storage.do('all', { type: 'commands' }, (err, commands) => {
    if (err || !commands) return logger.error(err.message);

    const count = Object.keys(commands).length;
    if (count <= 0) return;

    for (const id in commands) {
      if (commands[id].stopped == 'NULL') {
        logger.warn('Relaunching '); // modificar mensaje
        exports.perform(commands[id]);
        continue;
      }
    }
  });
};
