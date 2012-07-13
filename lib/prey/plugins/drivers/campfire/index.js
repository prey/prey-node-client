var common = require('./../../../common'),
		logger = common.logger,
		util = require('util'),
		hooks = require('./../../../hooks'),
		Campfire = require('campfire').Campfire,
		ConsoleDriver = require('./../console').ConsoleDriver,
		message_parser = require('./message_parser').parse;

var CampfireDriver = function(options){

	ConsoleDriver.call(this);
	var self = this;

	this.name = 'campfire';
	this.config = options;
	this.nickname = options.nickname || 'prey';
	this.destinations = {};

	this.load = function(callback){

		if(this.config.token == 'USER_TOKEN' || parseInt(this.config.room_id) == NaN)
			return callback(new Error("You need to set up your Campfire credentials."))

		if(common.program.connection_found)
			this.connect()
		else
			hooks.on('connection_found', function(){
				self.connect()
			});

		callback(null, this);

	};

	this.connect = function(){

		this.connection = new Campfire({
			ssl     : true,
			token   : this.config.token,
			account : this.config.subdomain
		});

		this.connection.me(function(error, data){

			if(!data || !data.user)
				return self.unload(new Error("Unable to get user data. Invalid credentials?"));

			self.user_id = data.user.id;

		});

		this.connection.join(parseInt(this.config.room_id), function(error, room) {

			if(!room)
				return self.unload(new Error("Unable to enter room " + self.config.room_id));

			self.room = room;
		  room.listen(function(message){
				self.parse_message(message);
			});

			self.greet();
			logger.info("Connected to room " + room.name + " at " + self.config.subdomain + ".campfirenow.com");

		});

		this.load_hooks();

	};

	this.greet = function(){
		var now = new Date();
		if(now.getHours() < 4)
			this.say("Bongiorno. It's kinda' late, don't you think?");
		else if(now.getHours() < 8)
			this.say("Good morning Vietnam!");
		else if(now.getHours() < 12)
			this.say("Hello folks. Nice day, is it not?");
		else if(now.getHours() < 16)
			this.say("Good afternoon. How was lunch?")
		else if(now.getHours() < 20)
			this.say("Hey there, what a long day, huh?");
		else if(now.getHours() < 24)
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
		this.emit('unload', err);
	};

	this.check_owner = function(message){
		if(this.owner_id && this.owner_id != message.userId){
			this.say("Definitely not you. Off you go.")
		} else if(!this.owner_id){
			if(!this.owner_id) this.owner_id = message.userId;
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
			if(error) logger.error("Unable to send message " + error);
			else logger.info("Message succesfully sent at " + response.message.created_at)
		});

	};

	this.paste = function(message, data){

		var str = data ? message + " received:\n\n" + JSON.stringify(data, null, 2) : message;

		self.room.paste(str, function(error, response){
			if(error) logger.error("Unable to send message " + error);
			else logger.info("Message succesfully sent at " + response.message.created_at)
		});

	};

	this.parse_message = message_parser;

};

util.inherits(CampfireDriver, ConsoleDriver);

var instance;

exports.load = function(options, callback){
	instance = new CampfireDriver(options);
	instance.load(callback);
}

exports.unload = function(){
	instance.unload();
}
