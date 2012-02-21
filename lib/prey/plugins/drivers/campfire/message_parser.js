exports.parse = function(message){

	// ignore emotes, timestamps, etc
	if (message.type != "TextMessage" || message.userId == self.user_id)
		return;

	var body = message.body.trim();
	// console.log("New message: " + body);

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

}