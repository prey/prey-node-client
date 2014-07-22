var common    = require('./common'),
    actions   = require('./actions'),
    triggers  = require('./triggers'),
    providers = require('./providers'),
    reports   = require('./reports'),
    updater   = require('./updater'),
    storage   = require('./utils/storage');

var storage_path = common.system.tempfile_path('local.db');
storage.init(storage_path);

// transforms this 'host:myhost.com user:god'
// into this: {host: 'myhost.com', user: 'god' }
var parse_arguments = function(args){
  if (!args || args.trim() === '') return;

  try {
    var formatted = args.trim().replace(/([\w\.]+)/g,'"$1"').replace(/" /g, '",');
    return JSON.parse('{' + formatted + '}');
  } catch(e) {
    console.log('Invalid argument format.');
  }
};

var get_destination = function(context, destination, args){
  var opts = args.trim() === '' ? null : parse_arguments(args);
  return {endpoint: destination, options: opts};
};

var command = function(command, target, options){
  return { command: command, target: target, options: options };
}

exports.parse = function(body){
  var c;

  if (matches = body.match(/^help\s?(\w+)?/))
    c = ['help', matches[1]];

  // on [event] [start|stop] [something]
  if (matches = body.match(/^(on|once) ([\w\-]+) (config|start|stop|get|set|send) (.+)/))
    c = ['hook', matches[1], matches[2], body];

  if (matches = body.match(/^config read ([\w-]+)/))
    c = ['config', [matches[1]]];

  if (matches = body.match(/^config update (\w+)\s(?:to )?(\w+)/))
    c = ['command', command('update', matches[1], matches[2]) ];

  if (matches = body.match(/^upgrade/))
    c = ['command', command('upgrade')];

  if (matches = body.match(/^start ([\w\-]+)(?: using|with )?(.*)/))
    c = ['command', command('start', matches[1], parse_arguments(matches[2]))];

  if (matches = body.match(/^watch ([\w\-]+)(?: using|with )?(.*)/))
    c = ['command', command('watch', matches[1], parse_arguments(matches[2]))];

  if (matches = body.match(/^stop ([\w\-]+)/))
    c = ['command', command('stop', matches[1])];

  if (matches = body.match(/^unwatch ([\w\-]+)/))
    c = ['command', command('unwatch', matches[1])];

  if (matches = body.match(/^(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(?: using|with )?(.*)/)){

    // var destination = matches[2] ? [matches[1].trim(), matches[2].trim(), matches[3]] : {};

    if (matches[1][0] == '/' && matches[1].match(/\.(...?)/))
      c = ['send_file', [matches[1].trim()]];
    else if (matches[1])
      c = ['command', command('get', matches[1].trim())];

  }

  return c;
}

exports.perform = function(command) {
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

  var method = methods[command.command] || methods[command.name];

  if (method)
    method(command.target, command.options);
  else
    handle_error(new Error('Unknown command: ' + (command.command || command.name)))
}

exports.process = function(str) {
  try {
    var commands = JSON.parse(str);
    logger.info('Got commands.');
  } catch(e) {
    return handle_error(new Error('Invalid commands: ' + str));
  }

  commands.forEach(exports.perform);
}

////////////////////////////////////////////////////////////////////
// command persistence
////////////////////////////////////////////////////////////////////

exports.run_stored = function(cb) {
  storage.all(function(err, commands) {
    if (err) return;

    var count = Object.keys(commands).length;
    logger.warn('Relaunching ' + count + ' commands previously in execution.');

    for (var key in commands)
      exports.perfoem(commands[key]);
  })
  storage.clear();
}

exports.store_running = function(cb) {
  var running_actions = actions.running(),
      running_reports = reports.running(),
      count           = running_actions.length + running_reports.length;

  if (count == 0)
    return cb && cb()

  logger.info(count + ' active actions/reports.')

  var done = function() {
    --count || (cb && cb())
  }

  var store = function(type, name, opts) {
    var key = [type, name].join('-');
    storage.set(key, { command: type, target: name, options: opts }, done)
  }

  running_actions.forEach(function(action) {
    store('start', action.name, action.options)
  })

  running_reports.forEach(function(report) {
    store('report', report.name, report.options)
  })
}
