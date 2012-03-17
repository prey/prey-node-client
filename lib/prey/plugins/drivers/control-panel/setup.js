var config = require('./index').config,
		program = require('commander');

var cb;

var start = exports.run = function(callback){

	exports.Register = require('./register');
	cb = callback;

	if (config.api_key != '')
		return callback(new Error("Your account has already been set up! You can run Prey now."));

	program.confirm('\nDo you already have an account at preyproject.com? ', function(yes){
		return yes ? existing_user(1) : new_user(1);
	});

};

var get_email_and_password = function(callback){

	program.prompt("Please type your account's email address: ", function(email){

		program.password('Well played. Now enter your password: ', '*', function(pass){

			return callback(email, pass);

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

		exports.Register.validate(options, function(err, data){

			if(!err){

				cb(null, data);
				// console.log("All good! Prey has been set up successfully.");

			} else if(attempt < 3) {

				console.log("Darn, couldn't make it. " + err.toString());
				console.log("Trying again in a sec...");

				setTimeout(function(){
					existing_user(++attempt);
				}, 1000);

			} else {

				console.log("Shoot. Seems like this is not your day. Try again in a while!");
				cb(err);

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
			exports.Register.new_user(data, function(err, data){

				if(!err){

					console.log("All good! Your account has been created. You can run Prey now.");
					cb(null, data);

				} else if(attempt < 3){

					console.log("Darn. Couldn't make it. Email typo perhaps? Let's try again in a sec...");

					setTimeout(function(){
						console.log("\n");
						new_user(++attempt);
					}, 1000);

				} else {

					console.log("Shoot. Seems like this is not your day. Try again in a while!");
					cb(err);

				}

			});

		});

	});

}
