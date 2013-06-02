'use strict;'

var common     = require('./common'),
    loader     = require('./loader'),
    updater    = require('./updater'),
    hooks      = require('./hooks'),
    command    = require('./command'),
    endpoints  = require('./endpoints'),
    actions    = require('./actions'),
    providers  = require('./providers'),
    reports    = require('./reports'),
    triggers   = require('./triggers'),
    exceptions = require('./exceptions');

var config     = common.config,
    logger     = common.logger.prefix('agent'),
    program    = common.program,
    running    = false,
    unloading  = false,
    started_at = null,
    running_as = null,
    drivers    = {},
    files      = []; // keep track for removal

////////////////////////////////////////////////////////////////////
// helpers
////////////////////////////////////////////////////////////////////

var is_running = function(){
  return running;
}

// returns either program.driver config.get('drivers')
var get_option = function(singular) {
  var plural = singular + 's';
  var arr = program[singular] ? [program[singular]] : (config.get(plural) || '').split(', ');
  return arr[0] == '' ? [] : arr;
}

var write_header = function(){
  var title = '\n  PREY ' + common.version + ' spreads its wings!';
  logger.write(title, 'light_red');
  logger.write('  Current time: ' + started_at.toString(), 'bold');

  var info = '  Running under Node ' +  process.version + ' with PID ' + process.pid;
  info += ' on a ' + process.arch + ' ' + common.os_name + ' system as ' + running_as + '\n';

  logger.write(info);
}

////////////////////////////////////////////////////////////////////
// bootup
////////////////////////////////////////////////////////////////////

var run = function() {
  if (running) return;
  running = true;

  if (program.run)
    return run_from_command_line();

  // env.RUNNING_USER is user by the updater to check if it was called by the agent
  running_as = process.env.RUNNING_USER = common.system.get_running_user();
  started_at = new Date();
  write_header();

  updater.check(function(err, new_version){
    if (err) handle_error(err);
    if (!new_version) return boot();

    logger.warn('Updated to version ' + version + '! Shutting down.');
  })
}

var engage = function(trigger) {
  hooks.trigger('woken', trigger);
}

var boot = function() {
  load_hooks();
  load_drivers(get_option('driver'), function(err){
    if (err) return; // hooks.unload(); // unloaded on shutdown

    triggers.watch(get_option('trigger'));
    endpoints.init(get_option('endpoint'), function(err){
      if (err) handle_error(err);

      logger.info('Initialized.');
    });
  });
};

var load_drivers = function(list, cb){
  if (!list || !list[0])
    return cb(new Error('No drivers set!'));

  var error;
  list.forEach(function(name){
    load_driver(name, {}, function(err, driver){
      if (err) {
        handle_error(err);
        error = err;
      }
    });
  });

  var success = Object.keys(drivers).length > 0;
  cb(!success && error);
}

var load_driver = function(name, opts, cb) {
  loader.load_driver(name, function(err, module){
    if (err) return cb && cb(err);

    module.load(opts, function(err, driver){
      if (err) return cb && cb(err);

      driver.on('command',  perform_command);
      driver.on('message',  process_message);
      driver.on('unload',   function() { driver_unloaded(name) });

      drivers[name] = module;
      cb && cb(null, driver)
    })
  })
}

var load_hooks = function() {
  hooks.on('action',   endpoints.notify_action)
  hooks.on('event',    endpoints.notify_event)
  hooks.on('data',     endpoints.send_data)
  hooks.on('report',   endpoints.send_report)
  hooks.on('response', handle_response)
  hooks.on('error',    handle_error)
  hooks.on('file',     files.push)
}

////////////////////////////////////////////////////////////////////
// commands, response and error handlers
////////////////////////////////////////////////////////////////////

var run_from_command_line = function(){
  logger.off();
  hooks.on('data', console.log)
  hooks.on('error', console.log)
  hooks.on('report', console.log)
  perform_command(command.parse(program.run)[1])
}

var perform_command = function(command) {

  var methods = {
    'start'   : actions.start,
    'stop'    : actions.stop,
    'watch'   : triggers.watch,
    'unwatch' : actions.stop,
    'get'     : providers.get,
    'report'  : reports.get,
    'cancel'  : reports.cancel,
    'driver'  : load_driver
  }

  var method = methods[command.command] || methods[command.name];

  if (method)
    method(command.target, command.options);
  else
    handle_error(new Error('Unknown command: ' + (command.target || command.name)))
}

var process_message = function(str) {
  logger.info('Got message.');

  try {
    var commands = JSON.parse(str);
  } catch(e) {
    return handle_error(new Error('Invalid commands: ' + str));
  }

  commands.forEach(perform_command);
}

var handle_response = function(what, endpoint, resp) {
  if (what == 'report' && resp.statusCode > 300)
    reports.cancel_all();
  else if (endpoint == 'control-panel' && resp.statusCode == 200)
    process_commands(resp.body);
}

var handle_error = function(err) {
  logger.error(err);

  if (config.get('send_crash_reports'))
    exceptions.send(err);
}

////////////////////////////////////////////////////////////////////
// shutdown
////////////////////////////////////////////////////////////////////

var disengage = function() {
  logger.debug('Unloading drivers.');
  unload_drivers();

  logger.debug('Stopping actions.');
  actions.stop_all();

  logger.info('Unloading hooks.');
  hooks.unload();

  logger.debug('Cancelling reports.');
  reports.cancel_all();

  logger.debug('Unwatching triggers.');
  triggers.unwatch();

  logger.debug('Cleaning up files.');
  common.helpers.remove_files(files);

  running = false;
}

var unload_drivers = function() {
  unloading = true;
  for (var name in drivers) {
    if (drivers[name].unload)
      drivers[name].unload(); // triggers 'unload' -> driver_unloaded
  }
}

var driver_unloaded = function(name) {
  delete drivers[name];

  if (!unloading && Object.keys(drivers).length == 0) {
    disengage();
  }
}

////////////////////////////////////////////////////////////////////
// exports
////////////////////////////////////////////////////////////////////

exports.run       = run;
exports.running   = is_running;
exports.engage    = engage;
exports.disengage = disengage;
