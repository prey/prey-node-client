#!/usr/bin/env node
//////////////////////////////////////////
// Prey JS Client
// (c) 2011, Fork Ltd. - http://forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var path = require('path');
process.env.ROOT_PATH = path.resolve(__dirname); // base.root_path;

////////////////////////////////////////
// base initialization
////////////////////////////////////////

try {
	var config = require(__dirname + '/config');
} catch(e) {
	console.log("No config file found!\n    Please copy config.js.default to config.js and set it up.\n");
	process.exit(1);
}

var base = require('./core/base'),
		logger = base.logger,
		pid_file = base.helpers.tempfile_path('prey.pid'),
		args = require('./core/args').init(base.version),
		Prey = require('./core/main');

/////////////////////////////////////////////////////////////
// event, signal handlers
/////////////////////////////////////////////////////////////

process.on('exit', function(code) {
	Prey.shutdown();
	if(code != 10) base.helpers.clean_up(pid_file);
	logger.info(" -- Have a jolly good day sir.\n");
});

process.on('SIGINT', function() {
	logger.info(' >> Got Ctrl-C!');
	process.exit(0);
});

process.on('SIGUSR1', function() {
	logger.info(' >> Received run instruction!');
	Prey.fire();
});

/*

process.on('uncaughtException', function (err) {
	console.log('Caught exception: ' + err);
	if(config.send_crash_reports) require('crash_notifier').send(err);
});

*/

/////////////////////////////////////////////////////////////
// launcher
/////////////////////////////////////////////////////////////

base.helpers.check_and_store_pid(pid_file, function(running_pid){

	if(running_pid){
		Prey.poke('localhost', function(){
			process.exit(10);
		});
	} else {
		Prey.run(config, args);
	}

});
