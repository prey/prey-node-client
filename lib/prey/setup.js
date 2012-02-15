//////////////////////////////////////////
// Prey Control Panel Setup Routine
// Written by Tomás Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		fs = require('fs'),
		path = require('path'),
		util = require('util'),
		plugin_loader = require('./plugin_loader'),
		emitter = require('events').EventEmitter,
		program = require('commander');

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
				return exit_error("Oops. Seems you don't have permissions to write in " + common.config_path);

			config_file_generated = true;
			config = require(common.config_file);

			generate_keys(function(err){
				if(err)
					return exit_error("Unable to generate SSL keys:" + err.toString());
					
				start_setup();

			})

		});

	}
}

var start_setup = function(){

	common.logger.off();
	var driver_name = program.driver || config.driver;
	
	plugin_loader.load_driver(driver_name, {}, null, function(module){

		if(!module)
			exit_error("Unable to find or load driver " + config.driver);
		else if(!module.config)
			exit_ok("All done. No configurable options for driver " + config.driver);
		else 
			setup_driver(module);

	})

};

var end_setup = function(err){
	if(err) exit_error("Could not store config values: " + err.toString());
	else exit_ok("All good. Prey has been setup successfully.");
}

var setup_driver = function(driver){
	
	try{
		var setup = require('./plugins/drivers/' + driver.name + '/setup');
	} catch(e){
		return manual_config(driver);
	}

	setup.run(function(err, values){
		if(err) exit_error(err);
		else store_values(driver, values, end_setup)
	});

}

var manual_config = function(driver){

	console.log("Configuring " + driver.name + " driver...");

	var readline = require('readline');
	var values = {};
	var fields = Object.keys(driver.config);
	
	var close_prompt = function(){
		rl.close();
		process.stdin.destroy();
		store_values(driver, values, end_setup);
	}
	
	var next_question = function(index, key, answer){
		if(key) values[key] = answer;

		var new_key = fields[index];
		if(!new_key) return close_prompt();
		
		var prompt = new_key + ": ";
		var current_value = driver.config[new_key];
		if(current_value !== '') prompt += "[" + current_value + "] ";

		rl.question(prompt, function(answer){
			next_question(++index, new_key, answer == '' ? current_value : answer);
		});
	}

	rl = readline.createInterface(process.stdin, process.stdout);
	next_question(0);

	rl.on('close', function(){
		if(fields.length > Object.keys(values).length) // terminated before going through all the questions
			exit_error("Ok maybe next time.");
	});

}

var store_values = function(driver, values, callback){
	common.helpers.store_config_values(['drivers', driver.name], values, end_setup);
}

var generate_keys = function(callback){
	
	var private_key = path.join(common.config_path, config.private_key_file);
	var certificate = path.join(common.config_path, config.certificate_file);
	var csr_file = path.join(common.config_path, 'ssl.csr');

	if(path.existsSync(private_key))
		return callback();
	
	var subject = "/C=US/ST=Some-State/L=Locality/O=Company/OU=Unit/CN=common.name.com";
	
	var cmd1 = "openssl genrsa -out " + private_key + " 2048";
	var cmd2 = "openssl req -new -key " + private_key + " -out " + csr_file + " -subj '" + subject + "'";
	var cmd3 = "openssl x509 -req -in " + csr_file + " -signkey " + private_key + " -out " + certificate;
	
	var exec = require('child_process').exec;

	console.log("Generating private key...")	
	exec(cmd1, function(err){
		if(err) callback(err);
		
		console.log(cmd2);
		console.log("Generating certificate sign request...");
		exec(cmd2, function(err){
			if(err) callback(err);
			
			console.log("Generating certificate...");
			exec(cmd3, function(err){
				if(err) callback(err);
				
				if(path.existsSync(certificate)){
					console.log("Certificate in place!");
					callback();
				} else {
					callback(new Error("Unable to generate certificate"));
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

	fs.open(log_file_path, 'w', function(err, fd){
		if(err) console.warn("Couldn't create log file in " + log_file_path);
		process.exit();
	});

};

var exit_error = function(msg){
	console.log("\n" + msg);

	if(!config_file_generated) return process.exit(1);

	fs.unlink(common.config_file, function(){
		console.log("Removing generated config file.");
		process.exit(1);
	});

};


if(process.platform != 'win32'){

process.on('SIGINT', function(){
	exit_error("Ok maybe next time. Farewell!");
});

}