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
		loader = require('./loader'),
		program = require('commander'),
		reply = require('reply');

var log_file_path = common.os.log_file_path;
var default_config_file = common.root_path + '/config.default';
var config_file_generated = false;
var prey_bin = path.join(__dirname, '..', '..', 'bin', 'prey.js');

var run = exports.run = function(){

	if(config.persisted()){

		start_setup();

	} else {

		console.log("Generating empty config file in " + common.config_file);
		config.sync(default_config_file, function(err){

			if(err)
				return exit_error("Oops. Seems you don't have permissions to write " + common.config_file + ". Try running with sudo.");

			// config_file_generated = true;
			// config = require(common.config_file);

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
	var driver_name = program.driver || config.get('driver');

	loader.load_driver(driver_name, function(err, module){

		if (err)
			exit_error(err);
		else if (!config.get(driver_name))
			exit_ok("All done. No configurable options for driver " + driver_name);
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

	if(!program.setup) run_prey();
};

var run_prey = function(){

	console.log('Running Prey for the first time...')

	setTimeout(function(){

		require('child_process').execFile(prey_bin, function(err, stdout){

			if (err) {
				console.log("Shoot. Something went wrong. Try running Prey again to see what's going on.")
			} else {
				console.log("Done! You can now close this window.\n");
				console.log("Or if you wish to play around with Prey, try the console mode: \n\n\t $ prey -d console\n")
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
		if(err) return exit_error(err);
		store_values(driver, values, end_setup);
	});

}

var manual_config = function(driver){

	console.log("Configuring " + driver.name + " driver...");
	reply.get(config.get(driver.name), function(err, results){
		if(!err) store_values(driver, results);
	});

}

var store_values = function(driver, values, callback){
	config.update(driver.name, values, end_setup);
}

var generate_keys = function(callback){

	var get_path = function(file_name){
		return path.join(common.config_path, file_name);
	}

	var private_key = get_path(config.get('private_key'));
	var certificate = get_path(config.get('certificate'));
	var csr_file = get_path('ssl.csr');

	fs.exists(private_key, function(exists){

		if(exists) return callback();

		var subject = "/C=US/ST=California/L=Locality/O=Company/OU=Unit/CN=common.name.com";

		var cmd1 = "openssl genrsa -out " + private_key + " 2048";
		var cmd2 = "openssl req -new -key " + private_key + " -out " + csr_file + " -subj '" + subject + "'";
		var cmd3 = "openssl x509 -req -in " + csr_file + " -signkey " + private_key + " -out " + certificate;

		var exec = require('child_process').exec;

		console.log("Generating private key and certificate...")
		exec(cmd1, function(err){
			if(err) callback(err);

			// console.log("Generating certificate sign request...");
			exec(cmd2, function(err){
				if(err) callback(err);

				// console.log("Generating certificate...");
				exec(cmd3, function(err){
					if(err) callback(err);

					fs.exists(certificate, function(exists){

						if(exists)
							callback();
						else
							callback(new Error("Failed to generate certificate. Try running openssl x509 by hand."));

					});
				})
			})
		})
	})

}

var exit_ok = function(msg){
	console.log(msg);

	if(program.driver && program.driver != config.get('driver')){
		config.update('driver', program.driver, function(err){
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
