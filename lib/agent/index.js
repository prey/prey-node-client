'use strict;'

var common      = require('./common'),
    loader      = require('./loader'),
    updater     = require('./updater'),
    hooks       = require('./hooks'),
    command     = require('./command'),
    endpoints   = require('./endpoints'),
    actions     = require('./actions'),
    providers   = require('./providers'),
    reports     = require('./reports'),
    triggers    = require('./triggers'),
    connection  = require('./connection'),
    exceptions  = require('./exceptions');

var config      = common.config,
    system      = common.system,
    logger      = common.logger.prefix('agent'),
    program     = common.program,
    helpers     = common.helpers,
    watch_list  = ['network', 'power'],
    config_wait = 120000, // 2 minutes
    running     = false,
    unloading   = false,
    started_at  = null,
    running_as  = null,
    drivers     = {},
    files       = []; // keep track for removal

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

  if (!config.get('auto_update'))
    return boot();

  updater.check(function(err, new_version){
    if (err) handle_error(err);
    if (!new_version) return boot();

    logger.warn('Updated to version ' + new_version + '! Shutting down.');
  });
}

var engage = function(trigger) {
  hooks.trigger('woken', trigger);
}

var boot = function() {
  common.setup(common, function(err, linked) {
    if (err) return handle_setup_error(err);

    load_hooks();
    load_drivers(get_option('driver'), function(err){
      if (err) throw err;

      triggers.watch(watch_list);
      endpoints.init(get_option('endpoint'), function(err){
        if (err) handle_error(err);

        connection.watch();
        logger.info('Initialized.');
      });
    });
  })
};

var load_drivers = function(list, cb){
  if (!list || !list[0])
    return cb(new Error('No drivers set!'));

  var errors = [];
  list.forEach(function(name){
    load_driver(name, {}, function(err, driver){
      if (err) {
        handle_error(err, name);
        errors.push(err);
      }
    });
  });

  var success = list.length > errors.length; // at least one succeeded
  cb(!success && errors[0]);
}

var load_driver = function(name, opts, cb) {
  loader.load_driver(name, function(err, module){
    if (err) return cb && cb(err);

    module.load(opts, function(err, driver){
      if (err) return cb && cb(err);

      driver.on('command',  perform_command);
      driver.on('message',  process_message);
      driver.on('unload',   function() { driver_unloaded(name) });

      logger.info('Driver loaded: ' + name);
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
// commands, response
////////////////////////////////////////////////////////////////////

var run_from_command_line = function(){
  logger.off();
  hooks.on('data', console.log);
  hooks.on('error', console.log);
  hooks.on('report', console.log);
  perform_command(command.parse(program.run)[1]);
}

var perform_command = function(command) {

  var methods = {
    'start'   : actions.start,
    'stop'    : actions.stop,
    'watch'   : triggers.add,
    'unwatch' : actions.stop,
    'get'     : providers.get,
    'report'  : reports.get,
    'cancel'  : reports.cancel,
    'driver'  : load_driver,
    'upgrade' : updater.check
  }

  var method = methods[command.command] || methods[command.name];

  if (method)
    method(command.target, command.options);
  else
    handle_error(new Error('Unknown command: ' + (command.target || command.name)))
}

var process_message = function(str) {
  try {
    var commands = JSON.parse(str);
    logger.info('Got commands.');
  } catch(e) {
    return handle_error(new Error('Invalid commands: ' + str));
  }

  commands.forEach(perform_command);
}

var handle_response = function(what, endpoint, resp) {
  if (what == 'reports' && resp.statusCode > 300)
    reports.cancel_all();
  else if (endpoint.name == 'control-panel' && resp.headers['X-Prey-Commands'])
    process_message(resp.body);
}

////////////////////////////////////////////////////////////////////
// error handling
////////////////////////////////////////////////////////////////////

var handle_setup_error = function(err) {
  if (!helpers.running_on_background())
    throw err;
  else
    wait_for_config();
}

var handle_error = function(err, source) {
  logger.error(err, source);

  if (err.code == 'EADDRINFO' || err.code == 'ENOTFOUND') // no connection
    // connection.down();
    logger.info('Connection seems to be down.')
  else if (config.get('send_crash_reports'))
    exceptions.send(err);
}

var wait_for_config = function() {
  logger.info('Not configured. Waiting ' + config_wait/1000  + ' secs to retry.')

  setTimeout(function(){
    config.reload();
    if (!config.get('api_key'))
      throw new Error('Not configured after ' + config_wait/1000 + ' secs.');

    boot();
  }, config_wait);
}

////////////////////////////////////////////////////////////////////
// shutdown
////////////////////////////////////////////////////////////////////

var shutdown = function() {
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
  logger.debug('Driver unloaded: ' + name + '. Active: ' + Object.keys(drivers).length);

  if (!unloading && Object.keys(drivers).length == 0) {
    shutdown();
  }
}

////////////////////////////////////////////////////////////////////
// exports
////////////////////////////////////////////////////////////////////

exports.run       = run;
exports.running   = is_running;
exports.engage    = engage;
exports.shutdown  = shutdown;
