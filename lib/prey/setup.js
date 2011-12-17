//////////////////////////////////////////
// Prey Setup Routine
// Written by Tomás Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		path = require('path'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		program = require('commander');

var root_path = process.env.ROOT_PATH || path.resolve(__dirname + '../../../')

var default_config_file = root_path + '/config.js.default';
var real_config_file = root_path + '/config.js';
var config_file_generated = false;

function copy_file(src, dest, callback){

	input = fs.createReadStream(path.resolve(src));
	output = fs.createWriteStream(path.resolve(dest));

	util.pump(input, output, function(){

		console.log('Copied ' + src  + ' to ' + dest);
		input.destroy() && output.destroy();
		callback();

	});

};

var exit_setup = function(msg){
	console.log(msg);
	process.exit();
};

var exit_error = function(msg){
	console.log("\n" + msg);

	if(!config_file_generated) return process.exit(1);

	fs.unlink(real_config_file, function(){
		console.log("Removing generated config file.");
		process.exit(1);
	});

};

var start_setup = function(){

	if(!config) var config = require(root_path + '/config');

	exports.Register = require('./register');
	exports.needle = require('needle');

	if (config.api_key != '') {
		exit_setup("Your account has already been set up! You can run Prey now.");
	}

	program.confirm('Do you already have an account at preyproject.com? ', function(ok){

		return ok ? existing_user(1) : new_user(1);

	});

};

var get_email_and_password = function(callback){

	program.prompt("Please type your account's email address: ", function(email){

		program.password('Well played. Now enter your password: ', '*', function(pass){

			callback(email, pass);

		});

	});

};

var existing_user = function(attempt){

	if(attempt == 1)
		console.log("Well hello old friend!");

	get_email_and_password(function(email, pass){

		var options = {
			username: email,
			password: pass
		}

		console.log("Verifying credentials...");

		exports.Register.validate(options, function(success){

			if(success){

				exit_setup("All good! Prey has been set up successfully.");

			} else if(attempt < 3) {

				console.log("Darn. Couldn't make it. Email typo perhaps? Let's try again in a sec...");

				setTimeout(function(){
					console.log("\n");
					existing_user(++attempt);
				}, 1000);

			} else {

				exit_error("Shoot. Seems like this is not your day. Try again in a while!");

			}

		});

	});

};

var new_user = function(attempt){

	if(attempt == 1)
		console.log("Warm greetings new friend.");

	get_email_and_password(function(email, pass){

		program.prompt("Ok, last one: What's your name? ", function(name){

			var data = {
				user: {
					name: name,
					email: email,
					password: pass,
					password_confirmation: pass
				}
			}

			console.log("Signing you up...");
			exports.Register.new_user(data, function(success){

				if(success){

					exit_setup("All good! Your account has been created. You can run Prey now.");

				} else if(attempt < 3){

					console.log("Darn. Couldn't make it. Email typo perhaps? Let's try again in a sec...");

					setTimeout(function(){
						console.log("\n");
						new_user(++attempt);
					}, 1000);

				} else {

					exit_error("Shoot. Seems like this is not your day. Try again in a while!");

				}

			});

		});

	});

}

try {

	var config = require(root_path + '/config');
	start_setup();

} catch(e) {

	console.log("No config file found. Generating new one for you...");
	copy_file(default_config_file, real_config_file, function(){
		config_file_generated = true;
		start_setup();
	});

}

process.on('SIGINT', function(){
	exit_error("Ok maybe next time. Farewell!");
});
