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
    watch_list  = ['connection', 'control-zones', 'location', 'network', 'power'],
    running     = false,
    connecting  = false, // semaphore for connection_down()
    started_at  = null,
    running_as  = null;

var loaded_plugins = [];

var JSEncrypt = require('node-jsencrypt');
var opn       = require('opn');

var device_keys = require('./utils/keys-storage');
var keys        = require('./plugins/control-panel/api/keys');
var lp2         = require('./../conf/long-polling');

var private_key,
    public_key;

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

  var info = '  Running with PID ' + process.pid + ' as ' + running_as + ' over Node.js ' +  process.version;
  info += [' on a', process.arch, common.os_name, 'system', '(' + common.os_release + ')'].join(' ') + '\n';

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

  manage_keys(function(err, encoded_public_key) {
    if (!keys.get().api) {
      lp2.load(function() {
        // opn('http://localhost:3000/' + encoded_public_key, {app: 'google chrome'})
        opn('http://10.10.2.98:3000/auth/start_configuration/' + encoded_public_key, {app: 'google chrome'})
      });
    }
  });

  if (program.mode == 'console')
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

  load_plugins(plugins.get_enabled(), function(err) {
    if (err) throw err;

    commands.run_stored();     // reload any actions previously in execution
    commands.start_watching(); // add/remove from list when started or stopped

    if (config.get('auto_update'))
      updater.check_every(12 * 60 * 60 * 1000); // check every 12 hours for new releases

    logger.info('Initialized.');
    // We initialize the triggers after all the plugins have been enabled,
    // so the plugins that subscribed to events triggered by the watchers
    // work as intended: ie. control-panel's long-polling.
    triggers.watch(watch_list);
  });
};

var reload = function() {
  logger.warn('Reloading!')
  config.reload();

  unload_plugins(function() {
    load_plugins(plugins.get_enabled(), function(err) {
      if (err) handle_error(err);

      logger.notice('Reload complete.');
    });
  });
}

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

  var parsed = commands.parse(program.run);
  if (!parsed)
    return console.log('Invalid command.');

  commands.perform(parsed[1]);
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
  var codes = ['ENETDOWN', 'ENETUNREACH', 'EADDRINFO', 'ENOTFOUND'];
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
  commands.stop_watching();
  updater.stop_checking();

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

  loaded_plugins.forEach(unload);

  function unload(name) {
    logger.debug('Unloading ' + name + ' plugin...')
    plugin.unload(name, function(err) {
      done(err, name);
    });
  }

  function done(err, name) {
    logger.debug('Plugin unloaded: ' + name);

    // MUTANT THING HERE. for some reason if we uncomment
    // these two lines, some (and only some) plugins will fail to be unloaded.
    // in other words, it makes the unload() function complete vanish without
    // leaving any traces. try/catch doesn't help.
    // var index = loaded_plugins.indexOf(name);
    // loaded_plugins.splice(index, 1);

    --count || (cb && cb());
  }

}

var manage_keys = function(cb) {
  var crypt = new JSEncrypt();

  device_keys.exist(['private', 'public'], function(err, exists, value) {
    if (exists) {

      private_key = value[0];
      public_key = value[1];

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      var publicKey = public_key.split('BEGIN PUBLIC KEY-----\n').pop().split('\n-----END').shift();

      var encoded_public_key = new Buffer(JSON.stringify(publicKey, null, 0)).toString('base64');
      return cb(null, encoded_public_key)

    } else {

      private_key = crypt.getPrivateKey();
      public_key = crypt.getPublicKey();

      crypt.setPublicKey(public_key);
      crypt.setPrivateKey(private_key);

      device_keys.store(['public', 'private'], [public_key, private_key], function(err) {
        if (err) return(cb(new Error("Error storing the keys")));

        var publicKey = public_key.split('BEGIN PUBLIC KEY-----\n').pop().split('\n-----END').shift();
        var encoded_public_key = new Buffer(JSON.stringify(public_key, null, 0)).toString('base64');

        cb(null, encoded_public_key);
      })

    }

  });
}

////////////////////////////////////////////////////////////////////
// exports
////////////////////////////////////////////////////////////////////

exports.private_key = private_key;
exports.public_key = public_key;
exports.run       = run;
exports.reload    = reload;
exports.running   = is_running;
exports.shutdown  = shutdown;
