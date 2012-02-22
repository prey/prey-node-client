exports.parse = function(message){
	
	// ignore emotes, timestamps, etc
	if (message.type != "TextMessage" || message.userId == this.user_id)
		return;

	var body = message.body.trim();
	// console.log("New message: " + body);

	var prey_nickname = new RegExp("^" + this.nickname);		
	if(!body.match(prey_nickname))
		return; // this.send("That's not for me.");
		
	if(matches = body.match(/help\s?(\w+)?/))
		return this.show_help(matches[1]);
		
	if(body.match(/hello$/))
		return this.say("Well hello there!");

	if(body.match(/rocks|awesome|great|incredible|amazing/))
		return this.say("Yes, yes, I know.");

	if(body.match(/fuck|shit|damn|suck/))
		return this.say("Hold on there! You got a problem?");

	if(body.match(/definitely|right|exactly|absolutely|sure|of course/))
		return this.say("I know. So what are you up to?");

		if(body.match(/the answer [to|of]/))
			return self.say("Everyone thinks its 42 but it's not.");

	if(body.match(/version$/))
		return this.say("Prey v" + common.version);
	
	if(body.match(/who's your daddy/))
		return this.check_owner(message);

	if(!this.owner_id)
		return this.say("Wait a minute, and who might *you* be?")
		
	if(this.owner_id != message.userId)
		return this.say("I'm not listening to you.");

	// from here on, the user is valid
	
	if(matches = body.match(/nick (\w+)/))
		return this.update_nickname(matches[1]);

	if(body.match(/logout$/))
		return this.logout();

	// if(body.match(/update/))
		// return this.emit('update');

	if(matches = body.match(/config get (\w+)/))
		return this.get_config(matches[1]);

	if(matches = body.match(/config set (\w+) to (\w+)/))
		return this.emit('set', matches[1], matches[2]);

	if(matches = body.match(/start ([\w\-]+)(?: using )?(.*)/))
		return this.emit('start', matches[1], this.parse_arguments(matches[2]));

	if(matches = body.match(/stop ([\w\-]+)/))
		return this.emit('stop', matches[1]);

	if(matches = body.match(/(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(?: using )?(.*)/)){

		if(matches[2]) 
			this.store_destination(matches[1].trim(), matches[2].trim(), matches[3]);

		if(matches[1].trim() == 'report')
			return this.emit('start', 'report');
		else if(matches[1][0] == '/' && path.existsSync(matches[1].trim()))
			return this.send_file(matches[1].trim());
		else
			return this.emit('get', matches[1].trim());

	}

	if(matches = body.match(/the (\w+)/))
		return this.say("What " + matches[1] + "?");

	this.say('What do you mean by "' + body.replace(this.nickname, '').trim() + '"?');

}