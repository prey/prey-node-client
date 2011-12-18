//////////////////////////////////////////
// Prey Setup Routine
// Written by Tomás Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		fs = require('fs'),
		path = require('path'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		program = require('commander');

var default_config_file = common.root_path + '/config.js.default';
var config_file_generated = false;

function copy_file(src, dest, callback){

	var pump = function(){
		
		input = fs.createReadStream(path.resolve(src));
		output = fs.createWriteStream(dest);

		util.pump(input, output, function(err){
		
			if (err) return callback(err);

			console.log('Copied ' + src  + ' to ' + dest);
			input.destroy() && output.destroy();
			callback();

		});

	}

	var dest = path.resolve(dest);
	var base_path = path.dirname(dest);
	if(!path.existsSync(base_path)){
		
		console.log("Creating directory: " + base_path);
		fs.mkdir(base_path, function(err){
			if(err) return callback(err);
			pump();
		})
		
	} else {
		pump();
	}

};

var exit_setup = function(msg){
	console.log(msg);
	process.exit();
};

var exit_error = function(msg){
	console.log("\n" + msg);

	if(!config_file_generated) return process.exit(1);

	fs.unlink(common.config_file, function(){
		console.log("Removing generated config file.");
		process.exit(1);
	});

};

var start_setup = function(){

	if(!config) var config = require(common.config_file);

	exports.Register = require('./register');

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

	console.log("Generating empty config file in " + common.config_file);
	copy_file(default_config_file, common.config_file, function(err){
		if(err){
			console.log("Couldn't create file or directory! Are you root?");
			return process.exit(1);
		}
		config_file_generated = true;
		start_setup();
	});

}

process.on('SIGINT', function(){
	exit_error("Ok maybe next time. Farewell!");
});
