#!/usr/bin/env node
//////////////////////////////////////////
// Prey NodeJS Client
// Written by Tomás Pollak
// (c) 2012, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var program = require('commander'),
		version = require(__dirname + '/../package').version;

/////////////////////////////////////////////////////////////
// command line options
/////////////////////////////////////////////////////////////

program
	.version(version)
	.option('-p, --path <path>', 'Path to config file [/etc/prey or C:\\$WINDIR\\Prey]')
	.option('-d, --driver <driver>', 'Driver to use for fetching instructions')
	.option('-a, --actions <actions>', 'Comma-separated list of actions to run on startup')
//	.option('-n, --nolog', 'Do not output to log file even if running via cron or trigger')
	.option('-D, --debug', 'Output debugging info')
	.option('-s, --setup', 'Run setup routine')
	.parse(process.argv);

var path = require('path'),
		common = require('./../lib/prey/common'),
		root_path = common.root_path,
		logger = common.logger,
		pid_file = common.helpers.tempfile_path('prey.pid'),
		Prey = require(root_path + '/lib/prey');

if (program.debug)
	common.logger.set_level('debug');

if(!common.config.persisted() || program.setup)
	return require(root_path + '/lib/prey/setup').run();

/////////////////////////////////////////////////////////////
// event, signal handlers
/////////////////////////////////////////////////////////////

process.on('exit', function(code) {
	var remove_pid = Prey.agent.running;
	Prey.agent.shutdown(); // sets agent.running = false
	if(remove_pid) {
		common.helpers.remove_pid_file(pid_file);
		logger.info('Have a jolly good day sir.\n');
	}
});

if (process.platform != 'win32') {

process.on('SIGINT', function() {
	logger.warn('Got Ctrl-C!');
	process.exit(0);
});

}

process.on('SIGUSR1', function() {
	logger.warn('Got SIGUSR1 signal!');
	Prey.agent.engage('interval');
});

process.on('SIGUSR2', function() {
	logger.warn('Got SIGUSR2 signal!');
	Prey.agent.engage('network');
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

	if(err) throw(err);
	if(!running) return Prey.agent.run();

	var run_time = (new Date() - running.stat.ctime)/(60 * 1000);
	console.error("Instance has been live for " + run_time.toString().substring(0,5) + " minutes\n");

	// don't poke instance if running since less than two minutes ago
	if(run_time < 2) return;

	var signal = process.env.TRIGGER ? 'SIGUSR2' : 'SIGUSR1';
	process.kill(running.pid, signal);
	process.exit(10);

});
