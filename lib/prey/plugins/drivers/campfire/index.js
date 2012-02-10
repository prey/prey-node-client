var common = require('./../../../common'),
		campfire_config = common.config.drivers.campfire;
		hooks = require('./../../../hook_dispatcher'),
		Campfire = require("campfire").Campfire,
		Emitter = require('events').EventEmitter;

var CampfireDriver = function(){

	var self = this;
	this.nickname = campfire_config.nickname || 'prey';
	
	this.load = function(){
		
		this.connection = new Campfire({
		  ssl     : true,
		  token   : campfire_config.token,
		  account : campfire_config.subdomain
		});
		
		this.connection.me(function(error, data){
			self.user_id = data.user.id;
		});
				
		this.connection.join(campfire_config.room_id, function(error, room) {
			self.room = room;
		  room.listen(self.parse_message);
			self.say("Greetings.")
			logger.info("Connected to room " + room.name + " at " + campfire_config.subdomain);
		});
		
		hooks.on('data', function(name, data){
			self.paste(name, data);
		});
		
		hooks.on('event', function(name, data){
			self.paste("Event triggered: " + name, data);
		});
		
	};
	
	this.logout = function(){
		this.say("I'll be back.");
		this.unload();
	}
	
	this.unload = function(){
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
			this.say("Definitely not you.")
		} else {
			if(!this.owner_id)this.owner_id = message.userId;
			self.say("Master, your wish is my command.");
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

		if(body.match(/awesome|great|incredible|amazing/))
			return self.say("Yes, yes, I know.");

		if(body.match(/fuck|shit|damn|suck/))
			return self.say("Hey, hold on there, mate.");

		if(body.match(/the money/))
			return self.say("What money?");

		if(body.match(/version$/))
			return self.say("Prey v" + common.version);
		
		if(body.match(/who's your daddy/))
			return self.check_owner(message);

		if(!self.owner_id)
			return self.say("I don't know who my daddy is.")
			
		if(self.owner_id != message.userId)
			return self.say("You're not my daddy. Sorry.");

		// from here on, the user is valid
		
		if(matches = body.match(/nick (\w+)/))
			return self.update_nickname(matches[1]);

		if(body.match(/logout$/))
			return self.logout();

		// if(body.match(/update/))
			// return self.emit('update');

		if(matches = body.match(/set (\w+)(.*)/))
			return self.emit('set', matches[1], matches[2]);

		if(matches = body.match(/start (\w+)(.*)/))
			return self.emit('start_action', matches[1], self.parse_arguments(matches[2]));

		if(matches = body.match(/stop (\w+)/))
			return self.emit('stop_action', matches[1]);

		if(matches = body.match(/[get|send] report(?: to )?(.*)/))
			return self.emit('start_action', 'report');

		if(matches = body.match(/[get|send] (\w+)(?: to )?(.*)/))
			return self.emit('get_info', matches[1]);

		self.send('What do you mean "' + body.replace(this.nickname, '').trim() + '"?');

	};


};

util.inherits(CampfireDriver, Emitter);
module.exports = new CampfireDriver();