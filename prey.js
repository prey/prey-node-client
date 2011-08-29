#!/usr/local/bin/node
//////////////////////////////////////////
// Prey JS Client
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

// set globals that are needed for all descendants
GLOBAL.base_path = __dirname;
GLOBAL.script_path = __filename;
GLOBAL.modules_path = base_path + '/prey_modules';
GLOBAL.os_name = process.platform.replace("darwin", "mac").replace('win32', 'windows');
os = require(base_path + '/platform/' + os_name);

////////////////////////////////////////
// base requires
////////////////////////////////////////

// require.paths.unshift(__dirname);
require('./lib/core_extensions');
require('./lib/logger');

var fs = require("fs"),
		util = require("util"),
		sys = require("sys"),
		helpers = require('./core/helpers'),
		Prey = require('./core/main');

////////////////////////////////////////
// base initialization
////////////////////////////////////////

var pid_file = helpers.tempfile_path('prey.pid');
GLOBAL.version = fs.readFileSync(base_path + '/version').toString().replace("\n", '');

try {
	GLOBAL.config = require(base_path + '/config').main;
} catch(e) {
	quit("No config file found!\n    Please copy config.js.default to config.js and set it up.\n")
}
GLOBAL.args = require('./core/args').init(version);
GLOBAL.user_agent = "Prey/" + version + " (NodeJS, "  + os_name + ")";

helpers.get_logged_user();

/////////////////////////////////////////////////////////////
// event handlers
/////////////////////////////////////////////////////////////

process.on('exit', function () {
	Prey.running = false;
	helpers.clean_up(pid_file);
	log(" -- Have a jolly good day sir.\n");
});

//process.on('uncaughtException', function (err) {
//  log('Caught exception: ' + err);
//});

/////////////////////////////////////////////////////////////
// signal handlers
/////////////////////////////////////////////////////////////

process.on('SIGINT', function () {
	log(' >> Got Ctrl-C!');
	process.exit(0);
});

process.on('SIGUSR1', function () {
	log(' >> Received run instruction!');
	Prey.fire();
});

/////////////////////////////////////////////////////////////
// launcher
/////////////////////////////////////////////////////////////

helpers.check_and_store_pid(pid_file);
Prey.run();
