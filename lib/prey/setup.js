//////////////////////////////////////////
// Prey Control Panel Setup Routine
// Written by Tomás Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		fs = require('fs'),
		path = require('path'),
		loader = require('./loader'),
		program = require('commander'),
		reply = require('reply');

var config;
var log_file_path = common.os.log_file_path;
var default_config_file = common.root_path + '/config.js.default';
var config_file_generated = false;

var run = exports.run = function(){

	try {

		config = require(common.config_file);
		start_setup();

	} catch(e) {

		console.log("Generating empty config file in " + common.config_file);
		common.helpers.copy_file(default_config_file, common.config_file, function(err){

			if(err)
				return exit_error("Oops. Seems you don't have permissions to write in " + common.config_path + ". Try running with sudo.");

			config_file_generated = true;
			config = require(common.config_file);

			generate_keys(function(err){
				if(err)
					return exit_error("Unable to generate SSL keys:" + err.toString());

				// console.log("SSL keys in place!");
				start_setup();

			})

		});

	}
}

var start_setup = function(){

	common.logger.off();
	var driver_name = program.driver || config.driver;

	loader.load_driver(driver_name, function(err, module){

		if(err)
			exit_error(err);
		else if(!module.config)
			exit_ok("All done. No configurable options for driver " + config.driver);
		else
			setup_driver(module);

	})

};

var end_setup = function(err){

	if(err) return exit_error("Could not store config values: " + err.toString());

	fs.open(log_file_path, 'w', function(err, fd){
		if(err) console.warn("Couldn't create log file in " + log_file_path);
	});

	console.log("\nPrey has been setup successfully!");
	if(!program.setup)
		run_prey();
};

var run_prey = function(){

	console.log('Running Prey for the first time...')

	setTimeout(function(){

		var child = require('child_process').spawn('prey');

		child.on('exit', function(code){
			if(code == 0){
				console.log("Done! You can now close this window.\n");
				console.log("Or if you wish to play around with Prey, try the console mode: \n\n\t $ prey -d console\n")
			} else {
				console.log("Shoot. Something went wrong. Try running Prey again to see what's going on.")
			}
			process.exit(code);
		})

	}, 1000);


}

var setup_driver = function(driver){

	try {
		var setup = require('./plugins/drivers/' + driver.name + '/setup');
	} catch(e) {
		return manual_config(driver);
	}

	setup.run(function(err, values){
		if(err) return exit_error(err);
		store_values(driver, values);
	});

}

var manual_config = function(driver){

	console.log("Configuring " + driver.name + " driver...");
	reply.get(driver.config, function(err, results){
		store_values(driver, results);
	});

}

var store_values = function(driver, values){
	// driver.config = values;
	common.helpers.store_config_values(['drivers', driver.name], values, end_setup);
}

var generate_keys = function(callback){

	var private_key = path.join(common.config_path, config.private_key_file);
	var certificate = path.join(common.config_path, config.certificate_file);
	var csr_file = path.join(common.config_path, 'ssl.csr');

	if(path.existsSync(private_key))
		return callback();

	var subject = "/C=US/ST=California/L=Locality/O=Company/OU=Unit/CN=common.name.com";

	var cmd1 = "openssl genrsa -out " + private_key + " 2048";
	var cmd2 = "openssl req -new -key " + private_key + " -out " + csr_file + " -subj '" + subject + "'";
	var cmd3 = "openssl x509 -req -in " + csr_file + " -signkey " + private_key + " -out " + certificate;

	var exec = require('child_process').exec;

	console.log("Generating private key and certificate...")
	exec(cmd1, function(err){
		if(err) callback(err);

		// console.log(cmd2);
		// console.log("Generating certificate sign request...");
		exec(cmd2, function(err){
			if(err) callback(err);

			// console.log("Generating certificate...");
			exec(cmd3, function(err){
				if(err) callback(err);

				if(path.existsSync(certificate)){
					callback();
				} else {
					callback(new Error("Failed to generate certificate. Try running openssl x509 by hand."));
				}
			})
		})
	})

}

var exit_ok = function(msg){
	console.log(msg);

	if(program.driver && program.driver != config.driver){
		common.helpers.store_main_config_value('driver', program.driver, function(err){
			if(!err) console.log("New driver set to " + program.driver);
		})
	}

};

var exit_error = function(msg){
	console.log("\n" + msg.toString());

	return process.exit(1);

/*

	if(!config_file_generated) return process.exit(1);

	fs.unlink(common.config_file, function(){
		console.log("Removing generated config file.");
		process.exit(1);
	});

*/

};

if(process.platform != 'win32'){

process.on('SIGINT', function(){
	exit_error("Ok maybe next time. Farewell!");
});

}
