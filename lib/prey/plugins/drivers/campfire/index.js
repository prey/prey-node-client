var common = require('./../../../common'),
		logger = common.logger,
		util = require('util'),
		hooks = require('./../../../hooks'),
		Campfire = require('campfire').Campfire,
		ConsoleDriver = require('./../console').ConsoleDriver;

var CampfireDriver = function(options){

	ConsoleDriver.call(this);
	var self = this;

	this.name = 'campfire';
	this.config = options;
	this.nickname = options.nickname || 'prey';
	this.destinations = {};
	
	this.load = function(){
		
		if(common.program.connection_found)
			this.connect()
		else
			hooks.on('connection_found', function(){
				self.connect()
			});
		
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
		  room.listen(self.parse_message);
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
	
	this.parse_message = function(message){

		// ignore emotes, timestamps, etc
    if (message.type != "TextMessage" || message.userId == self.user_id)
      return;

		var body = message.body.trim();
		logger.info("New message: " + body);

		var prey_nickname = new RegExp("^" + self.nickname);		
		if(!body.match(prey_nickname))
			return; // self.send("That's not for me.");
			
		if(matches = body.match(/help\s?(\w+)?/))
			return self.show_help(matches[1]);
			
		if(body.match(/hello$/))
			return self.say("Well hello there!");

		if(body.match(/rocks|awesome|great|incredible|amazing/))
			return self.say("Yes, yes, I know.");

		if(body.match(/fuck|shit|damn|suck/))
			return self.say("Hold on there! You got a problem?");

		if(body.match(/definitely|right|exactly|absolutely|sure|of course/))
			return self.say("I know. So what are you up to?");

		if(body.match(/version$/))
			return self.say("Prey v" + common.version);
		
		if(body.match(/who's your daddy/))
			return self.check_owner(message);

		if(!self.owner_id)
			return self.say("Wait a minute, and who might *you* be?")
			
		if(self.owner_id != message.userId)
			return self.say("I'm not listening to you.");

		// from here on, the user is valid
		
		if(matches = body.match(/nick (\w+)/))
			return self.update_nickname(matches[1]);

		if(body.match(/logout$/))
			return self.logout();

		// if(body.match(/update/))
			// return self.emit('update');

		if(matches = body.match(/config get (\w+)/))
			return self.get_config(matches[1]);

		if(matches = body.match(/config set (\w+) to (\w+)/))
			return self.emit('set', matches[1], matches[2]);

		if(matches = body.match(/start (\w+)(?: using )?(.*)/))
			return self.emit('start', matches[1], self.parse_arguments(matches[2]));

		if(matches = body.match(/stop (\w+)/))
			return self.emit('stop', matches[1]);

		if(matches = body.match(/(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(?: using )?(.*)/)){

			if(matches[2]) 
				self.store_destination(matches[1].trim(), matches[2].trim(), matches[3]);

			if(matches[1].trim() == 'report')
				return self.emit('start', 'report');
			else if(matches[1][0] == '/' && path.existsSync(matches[1].trim()))
				return self.send_file(matches[1].trim());
			else
				return self.emit('get', matches[1].trim());

		}

		if(matches = body.match(/the (\w+)/))
			return self.say("What " + matches[1] + "?");

		self.say('What do you mean by "' + body.replace(self.nickname, '').trim() + '"?');

	};


};

util.inherits(CampfireDriver, ConsoleDriver);

var instance;

exports.load = function(options, callback){
	instance = new CampfireDriver(options);
	instance.load();
	callback(null, instance);
}

exports.unload = function(){
	instance.unload();
}