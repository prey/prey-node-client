
"use strict";

var config = _ns('common').config.get('control-panel'),
		reply = require('reply'),
		register = require('./register'),
		destiny;

var log = function(str){
	console.log(str);
};

var setup = {

	attempt: 1,

	existing_user: function(callback){

		var self = this;
		if(this.attempt === 1) log("Well hello old friend!");

		this.get_email_and_password(function(err, email, pass){
			if(err) return callback(err);

			log("Verifying credentials...");

			var options = { username: email, password: pass };
			register.validate(options, function(err, data){
				self.check_response(err, data, callback);
			});

		});

	},

	new_user: function(callback){

		var self = this;
		if(this.attempt === 1) log("Warm greetings new friend.");

		this.get_email_and_password(function(err, email, pass){
			if(err) return callback(err);

			var name_opts = {
				message: "Ok, last one: What's your name?"
			};

			reply.get({name: name_opts}, function(err, answers){
				if(err) return callback(err);

				var data = {
					user: {
						name: answers.name,
						email: email,
						password: pass,
						password_confirmation: pass
					}
				};

				log("Signing you up...");
				register.new_user(data, function(err, data){
					self.check_response(err, data, callback);
				});

			});

		});

	},

	check_response: function(err, data, callback){

		if (!err){

			callback(null, data);

		} else if (this.attempt < 3) {

			log("Darn, couldn't make it: " + err.message);
			log("Trying again in a sec...\n");

			++this.attempt;
			var self = this;
			setTimeout(function(){ self[destiny](callback); }, 1000);

		} else {

			log("Shoot. Seems like this is not your day. Try again in a minute.");
			callback(err);

		}

	},

	get_email_and_password: function(callback){

		var options = {
			email: {
				message: "Please type your account's email address.",
				regex: /^([^\s]+)@([^\s]+)\.([^\s]+)$/
			},
			pass: {
				message: "Well played. Now enter your password.",
				type: 'password'
			}
		};

		reply.get(options, function(err, answers){
			callback(err, answers.email, answers.pass);
		});
  }
};

exports.run = function(callback) {

	if (config.api_key !== '')
		return callback(new Error("Account already set up! You can run Prey now."));

	process.stdout.write("\n");
	var question = "Do you already have an account at preyproject.com?";

	reply.confirm(question, function(err, yes){
		if(err) return callback(err);
		destiny = yes ? 'existing_user' : 'new_user';
		setup[destiny](callback);
	});
};