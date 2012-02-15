#!/usr/local/bin/node
//////////////////////////////////////////
// Prey NodeJS Client
// Written by Tomás Pollak
// (c) 2012, Fork Ltd. - http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var path = require('path'),
		root_path = process.env.ROOT_PATH = path.resolve(__dirname),
		common = require('./lib/prey/common'),
		program = common.program;

/////////////////////////////////////////////////////////////
// command line options
/////////////////////////////////////////////////////////////

program
	.version(common.version)
	.option('-p, --path <path>', 'Path to config file [/etc/prey or C:\\$WINDIR\\Prey]')
	.option('-d, --driver <driver>', 'Driver to use for fetching instructions')
	.option('-a, --actions <actions>', 'Comma-separated list of actions to run on startup')
	.option('-D, --debug', 'Output debugging info')
	.option('-s, --setup', 'Run setup routine')
	.parse(process.argv);

if (program.debug) process.env.DEBUG = true;

////////////////////////////////////////
// base initialization
////////////////////////////////////////

// we need to load config after we parse the arguments, in case a custom config path was given
common.load_config();

// if config file does not exist or setup was requested, stop here
if(!common.config || program.setup)
	return require(root_path + '/lib/prey/setup').run();

var logger = common.logger,
		pid_file = common.helpers.tempfile_path('prey.pid'),
		Prey = require('./lib/prey');

/////////////////////////////////////////////////////////////
// event, signal handlers
/////////////////////////////////////////////////////////////

process.on('exit', function(code) {
	Prey.agent.shutdown();
	if(code != 10) {
		common.helpers.clean_up(pid_file);
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
	logger.notice('Got SIGUSR1 signal!');
	Prey.agent.engage('SIGUSR1');
});

process.on('SIGUSR2', function() {
	logger.notice('Got SIGUSR2 signal!');
	Prey.agent.engage('SIGUSR2');
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

common.helpers.check_and_store_pid(pid_file, function(running_pid){

	if(running_pid){
		var signal = process.env.TRIGGER ? 'SIGUSR2' : 'SIGUSR1';
		process.kill(running_pid, signal);
		process.exit(10);
		// Prey.agent.poke('localhost', function(){
			// process.exit(10);
		// });
	} else {
		Prey.agent.run();
	}

});