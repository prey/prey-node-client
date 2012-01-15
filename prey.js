#!/usr/local/bin/node
//////////////////////////////////////////
// Prey JS Client
// Written by Tomás Pollak
// (c) 2011, Fork Ltd. - http://forkhq.com
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
	.option('-d, --debug', 'Output debugging info')
	.option('-s, --setup', 'Run setup routine')
	.parse(process.argv);

if (program.debug) process.env.DEBUG = true;

////////////////////////////////////////
// base initialization
////////////////////////////////////////

common.load_config();

if(!common.config || program.setup){
	return require(root_path + '/lib/prey/setup');
}

var logger = common.logger,
		pid_file = common.helpers.tempfile_path('prey.pid'),
		Prey = require(root_path + '/lib/prey');

/////////////////////////////////////////////////////////////
// event, signal handlers
/////////////////////////////////////////////////////////////

process.on('exit', function(code) {
	Prey.shutdown();
	if(code != 10) common.helpers.clean_up(pid_file);
	logger.info('Have a jolly good day sir.\n');
});

process.on('SIGINT', function() {
	logger.warn('Got Ctrl-C!');
	process.exit(0);
});

process.on('SIGUSR1', function() {
	logger.notice('Got SIGUSR1 signal!');
	Prey.engage();
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
		// process.kill(running_pid, 'SIGUSR1');
		Prey.poke('localhost', function(){
			process.exit(10);
		});
	} else {
		Prey.run();
	}

});
