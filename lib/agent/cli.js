#!/usr/bin/env node

//////////////////////////////////////////
// Prey Node.js Client
// Written by Tomás Pollak
// (c) 2012, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

"use strict";

var join = require('path').join,
    root_path = process.env.ROOT_PATH || join(__dirname, '..', '..'),
    version   = require(join(root_path, 'package')).version,
    program   = require('commander');

/////////////////////////////////////////////////////////////
// command line options
/////////////////////////////////////////////////////////////

program
   .version(version)
   .option('-p, --path <path>', 'Path to config file [/etc/prey or C:\\$WINDIR\\Prey]')
   .option('-d, --driver <driver>', 'Driver to use for fetching instructions')
   .option('-r, --run <command>', 'Run arbitrary command (eg. "get coordinates")')
   .option('-l, --logfile <logfile>', 'Logfile to use')
   .option('-D, --debug', 'Output debugging info')
   .parse(process.argv);

var common   = require('./common'),
    agent    = require('./'),
    twin     = require('twin'),
    logger   = common.logger;

if (!common.config.present()) {
  logger.write('\nNo config file found. Please run bin/prey config.\n');
  process.exit(1);
}

var log = function(str){
  if (process.stdout.writable)
    process.stdout.write(str);
}

/////////////////////////////////////////////////////////////
// event, signal handlers
/////////////////////////////////////////////////////////////

process.on('exit', function(code) {
  var remove_pid = agent.running;
  agent.shutdown(); // sets agent.running = false

  if (remove_pid) {
    // pid.remove(pid_file);
    logger.info('Have a jolly good day sir.\n');
  }
});

if (process.platform !== 'win32') {
  process.on('SIGINT', function() {
    logger.warn('Got Ctrl-C!');
    process.exit(0);
  });
}

// handle shutdown gracefully, removing PID
process.on('SIGTERM', function() {
  logger.warn('Killed by evil forces!');
  process.exit(1);
});

process.on('uncaughtException', function (err) {
  logger.critical('UNCAUGHT EXCEPTION: ' + err.message);
  logger.debug(err.stack);

  if (common.config.get('send_crash_reports'))
    require('./exceptions').send(err);

  process.exit(1);
});

////////////////////////////////////////////////////////////
// launcher
/////////////////////////////////////////////////////////////

twin.alive(function(alive, running){

  if (!alive) {

    twin.guard(function(err, hook){
      if (err) throw(err);

      hook.on('message', function(msg){
        if (msg.match(/SIGUSR/))
          agent.engage(msg == 'SIGUSR1' ? 'interval' : 'network');
      });
    })

    agent.run();

  } else {

    var run_time = (new Date() - new Date(running.since))/(60 * 1000);

    if (process.stdout._type == 'tty') {
      var run_time_str = run_time.toString().substring(0,5);
      log('\nLive instance for ' + run_time_str + ' minutes with PID: ' +  running.pid + '.\n');
    }

    // don't poke instance if running since less than two minutes ago
    // if (run_time < 2) return;

    var signal = process.env.TRIGGER ? 'SIGUSR2' : 'SIGUSR1';

    log('Sending signal: '  + signal  + '...' );
    twin.send(signal, function(received){
       log(received ? ' Great success!\n' : 'Unable to.\n');
    });

    setTimeout(function(){
      process.exit(10);
    }, 100);

  }

});
