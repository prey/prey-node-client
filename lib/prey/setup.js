//////////////////////////////////////////
// Prey Control Panel Setup Routine
// Written by Tomás Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		config = common.config,
		fs = require('fs'),
		path = require('path'),
		sslkeys = require('./utils/keygen'),
		loader = require('./loader'),
		program = require('commander'),
		reply = require('reply'),
		log_file_path = common.os.log_file_path;

var messages = {
	no_perms: "Oops. Seems you don't have write permissions. Try running with sudo.",
	ssl_keygen_error: "Unable to generate SSL keys:",
	ssl_keygen_success: "SSL keys in place!",
	done_no_config: "All done. No configurable options for driver ",
	setup_success: "\nPrey has been setup successfully!",
	first_run: 'Running Prey for the first time...',
	first_run_error: "Shoot, something went wrong. Try running Prey again to see what's going on.",
	first_run_ok: "Done! You can now close this window.\n",
	try_console: "Or if you wish to play around with Prey, try the console mode: \n\n\t $ prey -d console\n",
	maybe_next_time: "Ok maybe next time. Farewell!",
	error_creating_log_file: "Couldn't create log file in ",
	error_storing_values: "Could not store config values: "
}

var run = exports.run = function(){

	if (config.persisted()){

		start_setup();

	} else {

		console.log("Generating new config file...");
		fs.mkdir(path.resolve(program.path));

		config.sync(common.default_config_file, function(err){

			if(err) return exit_error(messages.no_perms);

			// config.private_key_path is invalid because config file does not exist
			var key_paths = {
				private_key: path.join(common.config_path, config.get('private_key')),
				certificate: path.join(common.config_path, config.get('certificate'))
			}

			sslkeys.generate(key_paths, function(err){
				if (err) return exit_error(messages.ssl_keygen_error + err.toString());

				console.log(messages.ssl_keygen_success);
				start_setup();

			})

		});

	}
}

var start_setup = function(){
	common.logger.off();
	var driver_name = program.driver || config.get('driver');

	loader.load_driver(driver_name, function(err, module){

		if (err)
			exit_error(err);
		else if (!config.get(driver_name))
			exit_ok(messages.done_no_config + driver_name);
		else
			setup_driver(module);

	})
};

var end_setup = function(err){
	if (err)
		return exit_error(messages.error_storing_values + err.toString());

	fs.open(log_file_path, 'w', function(err, fd){
		if (err) console.warn(messages.error_creating_log_file + log_file_path);
	});

	console.log(messages.setup_success);
	if (!program.setup) run_prey();
};

var run_prey = function(){

	console.log(messages.first_run);

	setTimeout(function(){

		require('child_process').execFile(common.script_path, function(err, stdout){

			if (err) {
				console.log(messages.first_run_error);
			} else {
				console.log(messages.first_run_ok);
				console.log(messages.try_console);
			}
			process.exit(err ? 1 : 0);
		});

	}, 1000);

}

var setup_driver = function(driver){

	try {
		var setup = require('./plugins/drivers/' + driver.name + '/setup');
	} catch(e) {
		return manual_config(driver);
	}

	setup.run(function(err, values){
		if (err) return exit_error(err);
		store_values(driver, values, end_setup);
	});

}

var manual_config = function(driver){
	console.log("Configuring " + driver.name + " driver...");
	reply.get(config.get(driver.name), function(err, results){
		if (!err) store_values(driver, results);
	});
}

var store_values = function(driver, values, callback){
	config.update(driver.name, values, end_setup);
}

var exit_ok = function(msg){
	console.log(msg);

	if (program.driver && program.driver != config.get('driver')){
		config.update('driver', program.driver, function(err){
			if (!err) console.log("New driver set to " + program.driver);
		})
	}

};

var exit_error = function(msg){
	console.log("\n" + msg.toString());
	return process.exit(1);
};

if(process.platform != 'win32'){

process.on('SIGINT', function(){
	exit_error(messages.maybe_next_time);
});

}
