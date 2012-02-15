var common = require('./../../../common'),
		util = require('util'),
		hooks = require('./../../../hooks'),
		Campfire = require("campfire").Campfire,
		Emitter = require('events').EventEmitter;

var CampfireDriver = function(){

	var self = this;
	
	this.load = function(options){

		this.config = options;
		this.nickname = config.nickname || 'prey';
		
		if(common.program.connection_found)
			this.connect()
		else
			hooks.on('connection_found', function(){
				self.connect()
			});
		
	};
	
	this.load_hooks = function(){

		hooks.on('data', function(name, data){
			self.paste(name, data);
		});
		
		hooks.on('event', function(name, data){
			self.paste("Event triggered: " + name, data);
		});
	}
	
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

		this.connection.join(this.config.room_id, function(error, room) {

			if(!room)
				return self.unload(new Error("Unable to enter room " + self.config.room_id));

			self.room = room;
		  room.listen(self.parse_message);
			self.greet();
			logger.info("Connected to room " + room.name + " at " + this.config.subdomain);

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
		if(err) common.logger.error(err);

		if(!this.room) return;
		logger.info("Leaving room " + this.room.name);
		this.room.leave();
	};
	
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
	
	this.show_help = function(){
		var str = "Available commands: \n\tversion\n\tupdate\n\tset [key] [value]\n\tget [info]";
		str += "\n\tstart [action]\n\tstop [action]";
		this.paste(str);
	};

	this.parse_arguments = function(args){
		
		if(!args || args.trim() == '')
			return null;

		try{
			var formatted = args.trim().replace(/(\w+)/g,'"$1"').replace(/ /g, ',');
			return JSON.parse("{" + formatted + "}");
		} catch(e){
			this.say("Invalid argument format. Usage: start [action] foo:bar baz:100");
			return null;
		}
		
	};

	// prey version	
	// prey update
	// prey set auto_connect to 3
	// prey get location
	// prey send screenshot to user@gmail.com
	// prey start report
	// prey start alarm 
	// prey stop lock
	
	this.parse_message = function(message){

		// ignore emotes, timestamps, etc
    if (message.type != "TextMessage" || message.userId == self.user_id)
      return;

		var body = message.body.trim();
		logger.info("New message: " + body);

		var prey_nickname = new RegExp("^" + self.nickname);		
		if(!body.match(prey_nickname))
			return; // self.send("That's not for me.");
			
		if(body.match(/help/))
			return self.show_help();
			
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

		if(matches = body.match(/set (\w+) to (\w+)/))
			return self.emit('set', matches[1], matches[2]);

		if(matches = body.match(/start (\w+)(.*)/))
			return self.emit('start_action', matches[1], self.parse_arguments(matches[2]));

		if(matches = body.match(/stop (\w+)/))
			return self.emit('stop_action', matches[1]);

		if(matches = body.match(/[get|send] report(?: to )?(.*)/))
			return self.emit('start_action', 'report');

		if(matches = body.match(/[get|send] (\w+)(?: to )?(.*)/))
			return self.emit('get_info', matches[1]);

		if(matches = body.match(/the (\w+)/))
			return self.say("What " + matches[1] + "?");

		self.say('What do you mean "' + body.replace(self.nickname, '').trim() + '"?');

	};


};

util.inherits(CampfireDriver, Emitter);
module.exports = new CampfireDriver();