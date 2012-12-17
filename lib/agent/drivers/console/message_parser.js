var fs = require('fs');

exports.parse = function(body){

	if (matches = body.match(/^help\s?(\w+)?/))
		return this.show_help(matches[1]);

	// if (body.match(/^update/))
		// return this.emit('update');

	// on [event] [start|stop] [something]
	if (matches = body.match(/^(on|once) ([\w\-]+) (config|start|stop|get|set|send) (.+)/))
		return this.add_hook(matches[1], matches[2], body);

	if (matches = body.match(/^config read ([\w-]+)/))
		return this.get_config(matches[1]);

	if (matches = body.match(/^config update (\w+)\s(?:to )?(\w+)/))
		return this.emit('update', matches[1], matches[2]);

	if (matches = body.match(/^start ([\w\-]+)(?: using|with )?(.*)/))
		return this.emit('start', matches[1], this.parse_arguments(matches[2]));

	if (matches = body.match(/^watch ([\w\-]+)(?: using|with )?(.*)/))
		return this.emit('watch', matches[1], this.parse_arguments(matches[2]));

	if (matches = body.match(/^stop ([\w\-]+)/))
		return this.emit('stop', matches[1]);

	if (matches = body.match(/^unwatch ([\w\-]+)/))
		return this.emit('unwatch', matches[1]);

	if (matches = body.match(/^(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(?: using|with )?(.*)/)){

		if (matches[2])
			this.store_destination(matches[1].trim(), matches[2].trim(), matches[3]);

		if (matches[1][0] == '/' && fs.existsSync(matches[1].trim()))
			return this.send_file(matches[1].trim());
		else
			return this.emit('get', matches[1].trim());

	}

	if (matches = body.match(/the (\w+)/))
		return this.say("What " + matches[1] + "?");

	this.say('Unknown command: ' + body);

}
