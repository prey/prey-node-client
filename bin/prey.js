//#!/usr/bin/env node

"use strict";

//////////////////////////////////////////
// Prey NodeJS Client
// Written by Tomás Pollak
// (c) 2012, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var
    join = require('path').join,
    root_path   = process.env.ROOT_PATH || join(__dirname, '..'),
    program = require('commander'),
    version = require(join(__dirname, '..', 'package')).version,
    control = require(join(root_path, 'lib')); // setup _ns, _error etc


/////////////////////////////////////////////////////////////
// command line options
/////////////////////////////////////////////////////////////

program
  .version(version)
  .option('-p, --path <path>', 'Path to config file [/etc/prey or C:\\$WINDIR\\Prey]')
  .option('-d, --driver <driver>', 'Driver to use for fetching instructions')
  .option('-a, --actions <actions>', 'Comma-separated list of actions to run on startup')
  .option('-l, --logfile <logfile>', 'Logfile to use')
  .option('-D, --debug', 'Output debugging info')
  .option('-s, --setup', 'Run setup routine')
  .parse(process.argv);

if (program.debug) control.debugOn();

control.debugOn();

var common = _ns('common'),
    agent = _ns('agent'),
    logger = common.logger,
    pid_file = common.helpers.tempfile_path('prey.pid');

if(!common.config.persisted() || program.setup)
  return require(join(root_path, 'lib', 'prey', 'setup')).run();


/////////////////////////////////////////////////////////////
// event, signal handlers
/////////////////////////////////////////////////////////////

process.on('exit', function(code) {
  var remove_pid = agent.running;
  agent.shutdown(); // sets agent.running = false

  if(remove_pid) {
    common.helpers.remove_pid_file(pid_file);
    logger.info('Have a jolly good day sir.\n');
  }
});

if (process.platform !== 'win32') {

  process.on('SIGINT', function() {
    logger.warn('Got Ctrl-C!');
    process.exit(0);
  });
}

process.on('SIGUSR1', function() {
  logger.warn('Got SIGUSR1 signal!');
  agent.engage('interval');
});

process.on('SIGUSR2', function() {
  logger.warn('Got SIGUSR2 signal!');
  agent.engage('network');
});

/*

process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err.stack);
  if(config.send_crash_reports && Prey.connection_found)
    require(root_path + '/lib/crash_notifier').send(err);
});

*/

/////////////////////////////////////////////////////////////
// launcher
/////////////////////////////////////////////////////////////

common.helpers.store_pid(pid_file, function(err, running){
  if (err) throw(err);

_tr("agent? "+running)  
  if (!running) return agent.run();

_tr('it was running send a signal')
  var run_time = (new Date() - running.stat.ctime)/(60 * 1000);
  var run_time_str = run_time.toString().substring(0,4);
  console.error("Instance has been live for " + run_time_str + " minutes\n");

  // don't poke instance if running since less than two minutes ago
  if (run_time < 2) return;

  var signal = process.env.TRIGGER ? 'SIGUSR2' : 'SIGUSR1';
  process.kill(running.pid, signal);
  process.exit(10);

});
