//////////////////////////////////////////
// Prey Campfire Driver
// Written by Tomas Pollak
// (c) 2012, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var util     = require('util'),
    common   = require('./../../common'),
		logger   = common.logger,
		hooks    = require('./../../hooks'),
		Campfire = require('campfire').Campfire,
		ConsoleDriver = require('./../console').ConsoleDriver,
		parser   = require('./message_parser').parse;

var CampfireDriver = function(options){

	ConsoleDriver.call(this);
	var self = this;

	this.name      = 'campfire';
	this.token     = options.token;
	this.room_id   = options.room_id;
	this.nickname  = options.nickname || 'prey';
	this.subdomain = options.subdomain;
	this.domain    = this.subdomain + '.campfirenow.com';
	this.destinations = {};

	this.load = function(callback){

		if(this.token == 'USER_TOKEN' || parseInt(this.room_id) == NaN)
			return callback(new Error("You need to set up your Campfire credentials."))

		self.connect();
	};

	this.connect = function(){

		this.connection = new Campfire({
			ssl     : true,
			token   : this.token,
			account : this.subdomain
		});

		this.connection.me(function(error, data){

			if (!data || !data.user)
				return self.unload(new Error("Unable to get user data. Invalid credentials?"));

			self.user_id = data.user.id;

		});

		this.connection.join(parseInt(this.room_id), function(error, room) {

			if (!room)
				return self.unload(new Error("Unable to enter room " + self.room_id));

			self.room = room;
		  room.listen(function(message){
				self.parse_message(message);
			});

			self.greet();
			logger.info("Connected to room " + room.name + " at " + self.domain);

		});

		this.load_hooks();

	};

	this.greet = function(){
		var now = new Date();
		if (now.getHours() < 4)
			this.say("Bongiorno. It's kinda' late, don't you think?");
		else if (now.getHours() < 8)
			this.say("Good morning Vietnam!");
		else if (now.getHours() < 12)
			this.say("Hello folks. Nice day, is it not?");
		else if (now.getHours() < 16)
			this.say("Good afternoon. How was lunch?")
		else if (now.getHours() < 20)
			this.say("Hey there, what a long day, huh?");
		else if (now.getHours() < 24)
			this.say("Greetings. Fine evening it is, wouldn't you say?")
	}

	this.logout = function(){
		this.say("I'll be back.");
		this.unload();
	}

	this.unload = function(err){
		if(err) logger.error(err);

		if(!this.room) return;
		logger.info("Leaving room " + this.room.name);
		this.room.leave();

		hooks.removeAllListeners();

		this.running.forEach(function(action){
			self.emit('stop', action);
		});

		this.emit('unload', err);
	};

	this.check_owner = function(message){
		if (this.owner_id && this.owner_id != message.userId){
			this.say("Definitely not you. Off you go.")
		} else if (!this.owner_id){
			if (!this.owner_id) this.owner_id = message.userId;
			self.say("Welcome back, master. Your wish is my command.");
		} else {
			self.say("Awaiting your command, master.");
		}
	};

	this.update_nickname = function(nick){
		this.nickname = nick.trim();
		this.say("I will now respond to messages that begin with " + this.nickname);
	}

	this.say = function(message, data){

		var str = data ? message + " received:\n\n" + JSON.stringify(data, null, 2) : message;

		self.room.speak(str, function(error, response){
			if (error) logger.error("Unable to send message " + error);
			else logger.info("Message succesfully sent at " + response.message.created_at)
		});

	};

	this.paste = function(message, data){

		var str = data ? message + " received:\n\n" + JSON.stringify(data, null, 2) : message;

		self.room.paste(str, function(error, response){
			if (error) logger.error("Unable to send message " + error);
			else logger.info("Message succesfully sent at " + response.message.created_at)
		});

	};

	this.parse_message = parser;

};

util.inherits(CampfireDriver, ConsoleDriver);

exports.load = function(options, callback){
	this.campfire = new CampfireDriver(options);
	this.campfire.load(callback);
}

exports.unload = function(){
	this.campfire.unload();
}
