/////////////////////////////////////////////////////////////
// Prey Node.js Client
// Written by Tomás Pollak
// (c) 2011-2014, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
/////////////////////////////////////////////////////////////

"use strict";

var common      = require('./common'),
    updater     = require('./updater'),
    hooks       = require('./hooks'),
    plugin      = require('./plugin'),
    commands    = require('./commands'),
    actions     = require('./actions'),
    triggers    = require('./triggers'),
    reports     = require('./reports'),
    providers   = require('./providers'),
    logo        = require('./utils/logo');

var config      = common.config,
    system      = common.system,
    logger      = common.logger,
    program     = common.program,
    helpers     = common.helpers,
    exceptions  = common.exceptions,
    plugins     = common.plugins,
    watch_list  = ['connection', 'network', 'power'],
    running     = false,  
    connecting  = false, // semaphore for connection_down()
    started_at  = null,
    running_as  = null;

var loaded_plugins = [];

////////////////////////////////////////////////////////////////////
// helpers
////////////////////////////////////////////////////////////////////

var is_running = function() {
  return running;
}

var write_header = function() {

  function write(str, color) {
    logger.write(logger.paint(str, color))
  }

  write('\n' + logo, 'grey');
  var title = '\n  PREY ' + common.version + ' spreads its wings!';
  write(title, 'light_red');
  write('  Current time: ' + started_at.toString(), 'bold');

  var info = '  Running under Node ' +  process.version + ' with PID ' + process.pid;
  info += ' on a ' + process.arch + ' ' + common.os_name + ' system as ' + running_as + '\n';

  write(info);
}

////////////////////////////////////////////////////////////////////
// bootup
////////////////////////////////////////////////////////////////////

var run = function() {
  if (running) return;
  running = true;

  if (program.run)
    return run_from_command_line();

  process.title = 'prx'; // stealth camouflage FTW!

  // env.RUNNING_USER is user by the updater to check if it was called by the agent
  running_as = process.env.RUNNING_USER = common.system.get_running_user();
  started_at = new Date();
  write_header();

  if (program.driver == 'console')
    return load_plugin('console');

  if (!config.get('auto_update'))
    return boot();

  updater.check(function(err, new_version) {
    if (err && err.code != 'NO_VERSIONS_SUPPORT') 
        handle_error(err);
 
    if (!new_version) return boot();

    logger.warn('Updated to version ' + new_version + '! Shutting down.');
  });
}

var boot = function() {
  hooks.on('error', handle_error);
  triggers.watch(watch_list);

  load_plugins(plugins.get_enabled(), function(err){
    if (err) throw err;

    commands.run_stored();
    logger.info('Initialized.');
  });
};

var load_plugins = function(list, cb) {
  if (!list || !list[0])
    return cb(new Error('No plugins set!'));

  var count  = list.length,
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
    var success = list.length > errors.length; // at least one succeeded
    cb(!success && errors[0]);
  }

  list.forEach(function(name) {
    load_plugin(name, done);
  });

}

var load_plugin = function(name, cb) {
  plugin.load(name, function(err) {
    if (err) {
      if (err.code == 'MODULE_NOT_FOUND')
        return plugins.remove(name, cb);
      
      return cb && cb(err, name);
    }

    logger.info('Plugin loaded: ' + name);
    loaded_plugins.push(name);
    cb && cb(null, name);
  })
}

////////////////////////////////////////////////////////////////////
// commands, response
////////////////////////////////////////////////////////////////////

var run_from_command_line = function() {
  if (!program.debug) logger.pause();
  hooks.on('data', console.log);
  hooks.on('error', console.log);
  hooks.on('report', console.log);
  commands.perform(commands.parse(program.run)[1]);
}

////////////////////////////////////////////////////////////////////
// hooks and error handling
////////////////////////////////////////////////////////////////////

var handle_error = function(err, source) {
  logger.error(err, source);

  if (is_network_error(err)) // no connection
    connection_down();
  else if (config.get('send_crash_reports'))
    exceptions.send(err);
}

var is_network_error = function(err) {
  var codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND', 'ECONNRESET'];
  return codes.indexOf(err.code) !== -1;
}

var connection_down = function() {
  if (connecting || !config.get('auto_connect'))
    return false;

  connecting = true;
  logger.notice('Lost connection. Trying to connect...');
  system.reconnect(function(err, out) {
    if (err) hooks.trigger('error', err);
    connecting = false;
  });
}

////////////////////////////////////////////////////////////////////
// shutdown
////////////////////////////////////////////////////////////////////

var shutdown = function(cb) {
  // if a plugin was loaded after unload_plugins() was called
  // we need to be able to call unload() on it again. so we need to comment this.
  // if (!running) return;

  running = false;

  logger.debug('Saving running commands...')
  commands.store_running();

  logger.debug('Unloading plugins.');
  unload_plugins(cb);

  logger.debug('Stopping actions.');
  actions.stop_all();

  logger.debug('Unloading hooks.');
  hooks.unload();

  logger.debug('Canceling reports.');
  reports.cancel_all();

  logger.debug('Unwatching triggers.');
  triggers.unwatch();

  logger.debug('Cleaning up temporary files.');
  providers.remove_files();
}

var unload_plugins = function(cb) {
  var count = loaded_plugins.length;

  var done = function(err, name) {
    logger.debug('Plugin unloaded: ' + name);

    // MUTANT THING HERE. for some reason if we uncomment 
    // these two lines, some (and only some) plugins will fail to be unloaded.
    // in other words, it makes the unload() function complete vanish without
    // leaving any traces. try/catch doesn't help. 
    // var index = loaded_plugins.indexOf(name);
    // loaded_plugins.splice(index, 1);

    --count || (cb && cb());
  }

  var unload = function(name) {
    logger.debug('Unloading ' + name + ' plugin...')
    plugin.unload(name, function(err) { 
      done(err, name);
    });
  }

  loaded_plugins.forEach(unload);
}

////////////////////////////////////////////////////////////////////
// exports
////////////////////////////////////////////////////////////////////

exports.run       = run;
exports.running   = is_running;
exports.shutdown  = shutdown;
