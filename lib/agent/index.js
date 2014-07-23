/////////////////////////////////////////////////////////////
// Prey Node.js Client
// Written by Tomás Pollak
// (c) 2013, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
/////////////////////////////////////////////////////////////

'use strict;'

var common      = require('./common'),
    loader      = require('./loader'),
    updater     = require('./updater'),
    hooks       = require('./hooks'),
    plugin      = require('./plugin'),
    commands    = require('./commands'),
    actions     = require('./actions'),
    triggers    = require('./triggers'),
    reports     = require('./reports'),
    providers   = require('./providers'),
    connection  = require('./connection'),
    exceptions  = require('./exceptions');

var config      = common.config,
    system      = common.system,
    logger      = common.logger.prefix('agent'),
    program     = common.program,
    helpers     = common.helpers,
    watch_list  = ['network', 'power'],
    running     = false,
    unloading   = false,
    started_at  = null,
    running_as  = null,
    plugins     = {},
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

  if (program.driver == 'console')
    return load_plugin('console');

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
  load_hooks();
  load_plugins(get_option('plugin'), function(err){
    if (err) throw err;

    triggers.watch(watch_list);
    connection.watch();
    commands.run_stored();

    logger.info('Initialized.');
  });
};

var load_plugins = function(list, cb) {
  if (!list || !list[0])
    return cb(new Error('No plugins set!'));

  var count = list.length,
      errors = [];

  var done = function(err, name) {
    if (err) {
      handle_error(err, name);
      errors.push(err);
    }
    --count || finished();
  }

  var finished = function() {
    logger.info(list.length + ' plugins loaded with ' + errors.length + ' errors.')
    var success = errors.length == 0; // list.length > errors.length; // at least one succeeded
    cb(!success && errors[0]);
  }

  list.forEach(function(name) {
    load_plugin(name, done);
  });

}

var load_plugin = function(name, cb) {
  plugin.load(name, function(err) {
    if (err) return cb && cb(err);

    // plugins now dont return an emitter
    // plugin.on('command',  perform_command);
    // plugin.on('message',  process_message);
    // plugin.on('unload',   function() { plugin_unloaded(name) });

    logger.info('Plugin loaded: ' + name);
    plugins[name] = module;
    cb && cb(null, name)
  })
}

////////////////////////////////////////////////////////////////////
// commands, response
////////////////////////////////////////////////////////////////////

var run_from_command_line = function() {
  if (!program.debug) logger.off();
  hooks.on('data', console.log);
  hooks.on('error', console.log);
  hooks.on('report', console.log);
  commands.perform(command.parse(program.run)[1]);
}

////////////////////////////////////////////////////////////////////
// hooks and error handling
////////////////////////////////////////////////////////////////////

var load_hooks = function() {
  hooks.on('error', handle_error)
  hooks.on('file',  files.push)
}

var handle_error = function(err, source) {
  logger.error(err, source);

  if (err.code == 'EADDRINFO' || err.code == 'ENOTFOUND') // no connection
    connection_down();
  else if (config.get('send_crash_reports'))
    exceptions.send(err);
}

var connection_down = function(cb) {
  if (!config.get('auto_connect'))
    return false;

  logger.notice('Lost connection. Trying to connect...');
  system.reconnect(function(err, out){
    if (err) return cb && cb(false);
  });
}

////////////////////////////////////////////////////////////////////
// shutdown
////////////////////////////////////////////////////////////////////

var shutdown = function() {
  logger.debug('Saving running commands...')
  commands.store_running();

  logger.debug('Unloading plugins.');
  unload_plugins();

  logger.debug('Stopping actions.');
  actions.stop_all();

  logger.debug('Unloading hooks.');
  hooks.unload();

  logger.debug('Canceling reports.');
  reports.cancel_all();

  logger.debug('Unwatching triggers.');
  triggers.unwatch();

  logger.debug('Cleaning up files.');
  common.helpers.remove_files(files);

  running = false;
}

var unload_plugins = function() {
  unloading = true;
  for (var name in plugins) {
    if (plugins[name].unload) {
      plugins[name].unload(function() { plugin_unloaded(name) });
    }
  }
}

var plugin_unloaded = function(name) {
  delete plugins[name];
  logger.debug('Plugin unloaded: ' + name + '. Active: ' + Object.keys(plugins).length);

  if (!unloading && Object.keys(plugins).length == 0) {
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
