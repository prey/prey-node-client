var join      = require('path').join,
    common    = require('./common'),
    hooks     = require('./hooks'),
    actions   = require('./actions'),
    triggers  = require('./triggers'),
    providers = require('./providers'),
    reports   = require('./reports'),
    updater   = require('./updater'),
    storage   = require('./utils/storage');

var logger    = common.logger;
var watching  = false; // flag for storing new commands when fired

var storage_path = join(common.system.paths.config, 'commands.db');
storage.init(storage_path);

////////////////////////////////////////////////////////////////////
// helpers

// transforms this 'host:myhost.com user:god'
// into this: {host: 'myhost.com', user: 'god' }
var parse_arguments = function(args) {
  if (!args || args.trim() === '') return;

  try {
    var formatted = args.trim().replace(/([\w\.]+)/g,'"$1"').replace(/" /g, '",');
    return JSON.parse('{' + formatted + '}');
  } catch(e) {
    console.log('Invalid argument format.');
  }

};

var get_destination = function(context, destination, args) {
  var opts = args.trim() === '' ? null : parse_arguments(args);
  return { endpoint: destination, options: opts };
};

var handle_error = function(err) {
  hooks.trigger('error', err);
}

////////////////////////////////////////////////////////////////////
// build/run/parse/perform/process exports

exports.build = function build(command, target, options) {
  var obj = { command: command, target: target };
  if (options) obj.options = options;
  return obj;
}

exports.run = function(command, target, options) {
  var obj = exports.build(command, target, options);
  if (obj) exports.perform(obj);
}

exports.parse = function(body) {
  var c;

  if (matches = body.match(/^help\s?(\w+)?/))
    c = ['help', matches[1]];

  // on [event] [start|stop] [something]
  if (matches = body.match(/^(on|once) ([\w\-]+) (config|start|stop|get|set|send) (.+)/))
    c = ['hook', matches[1], matches[2], body];

  if (matches = body.match(/^config read ([\w-]+)/))
    c = ['config', [matches[1]]];

  if (matches = body.match(/^config update (\w+)\s(?:to )?(\w+)/))
    c = ['command', this.build('update', matches[1], matches[2]) ];

  if (matches = body.match(/^upgrade/))
    c = ['command', this.build('upgrade')];

  if (matches = body.match(/^start ([\w\-]+)(?: (using|with) )?(.*)/))
    c = ['command', this.build('start', matches[1], parse_arguments(matches[3]))];

  if (matches = body.match(/^watch ([\w\-]+)(?: (using|with) )?(.*)/))
    c = ['command', this.build('watch', matches[1], parse_arguments(matches[3]))];

  if (matches = body.match(/^stop ([\w\-]+)/))
    c = ['command', this.build('stop', matches[1])];

  if (matches = body.match(/^unwatch ([\w\-]+)/))
    c = ['command', this.build('unwatch', matches[1])];

  if (matches = body.match(/^(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(?: (using|with) )?(.*)/)) {

    // var destination = matches[2] ? [matches[1].trim(), matches[2].trim(), matches[3]] : {};

    if (matches[1][0] == '/' && matches[1].match(/\.(...?)/))
      c = ['send_file', [matches[1].trim()]];
    else if (matches[1])
      c = ['command', this.build('get', matches[1].trim())];

  }

  return c;
}

exports.perform = function(command) {
  if (!command)
    return handle_error(new Error('No command received'));

  logger.debug("Command received: " + JSON.stringify(command));

  var methods = {
    'start'   : actions.start,
    'stop'    : actions.stop,
    'watch'   : triggers.add,
    'unwatch' : actions.stop,
    'get'     : providers.get,
    'report'  : reports.get,
    'cancel'  : reports.cancel,
    'upgrade' : updater.check
  }

  // Intercept {command: 'get', target: 'report', options: {interval: 5}}
  // This kind of report should be storable. To ensure it can be stored we need
  // to change it to {command: 'report', target: 'stolen'}
  if (command.command === "get" && command.target === "report" && command.options.interval) {
    command.command = 'report';
    command.target = 'stolen';
  }

  var type    = command.command || command.name,
      method  = methods[type];

  if (method) {
    hooks.trigger('command', method, command.target, command.options);
    method(command.target, command.options);
    update_stored(type, command.target, command.options);
  } else {
    handle_error(new Error('Unknown command: ' + (command.command || command.name)))
  }
}

exports.process = function(str) {
  try {
    var commands = JSON.parse(str);
    logger.info('Got commands.');
  } catch(e) {
    return handle_error(new Error('Invalid commands: ' + str));
  }

  commands.forEach(this.perform);
}

////////////////////////////////////////////////////////////////////
// command persistence

var store = function(type, name, opts, cb) {
  var key = [type, name].join('-');
  logger.debug('Storing command in DB: ' + key);
  storage.set(key, { command: type, target: name, options: opts }, cb);
}

var remove = function(type, name, cb) {
  var key = [type, name].join('-');
  logger.debug('Removing command from DB: ' + key);
  storage.del(key, cb);
}

// record when actions, triggers and reports are started
var update_stored = function(type, name, opts) {
  if (!watching) return;

  var storable = ['start', 'watch', 'report'];

  if (type == 'cancel') // report cancelled
    remove('report', name);
  else if (storable.indexOf(type) !== -1) // ok for launch
    store(type, name, opts);
}

// listen for new commands and add them to storage, in case the app crashes
var watch_stopped = function() {
  if (!watching) return;

  hooks.on('action', function(event, name) {
    if (event == 'stopped' || event == 'failed')
      remove('start', name);
  });

  hooks.on('trigger', function(event, name) {
    if (event == 'stopped')
      remove('watch', name);
  });
}

exports.start_watching = function() {
  watching = true;
  watch_stopped();
}

exports.stop_watching = function() {
  watching = false;
}

exports.run_stored = function(cb) {
  storage.all(function(err, commands) {
    if (err)
      return logger.error(err.message);

    var count = Object.keys(commands).length;
    if (count <= 0)
      return;

    logger.warn('Relaunching ' + count + ' commands previously in execution.');

    for (var key in commands)
      exports.perform(commands[key]);
  })

  storage.clear();
}
