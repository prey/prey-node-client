//////////////////////////////////////////
// Prey Console Driver
// Written by Tomas Pollak
// (c) 2011, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var util = require('util'),
		path = require('path'),
		fs = require('fs'),
		common = require('./../../../common'),
 		readline = require('readline'),
		hooks = require('./../../../hooks'),
		dispatcher = require('./../../../dispatcher'),
		Emitter = require('events').EventEmitter;

var ConsoleDriver = function(options){

	var self = this;
	this.destinations = {};
	this.options = options;

	this.email_regex = /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/;
	this.host_regex = /[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}/;

	this.load = function(options){
		this.load_prompt();
		this.load_hooks();
		this.emit('loaded');
		// common.logger.setTimestamp = false;
	};
	
	this.load_prompt = function(){
		
 		var rl = this.prompt = readline.createInterface(process.stdin, process.stdout);
		var prefix = 'prey> ';

		rl.on('line', function(line){
			
			if(line.trim() == 'quit' || line.trim() == 'exit')
				return rl.close();

			if(line.trim() != '')
				self.parse_message(line.trim());

			rl.setPrompt(prefix, prefix.length);
			rl.prompt();

		});

		rl.on('close', function() {
		  self.stop();
		});

		setTimeout(function(){

			console.log("\n" + prefix + 'Welcome back, master. Try typing help.');

			rl.setPrompt(prefix, prefix.length);
			rl.prompt();

		}, 500);

	};
	
	this.load_hooks = function(){

		hooks.on('data', function(name, data){

			if(self.destinations[name]) // if we were asked for another destination
				self.post(name, data);
			else
				self.write(name, data);

			self.prompt.prompt();
		});
		
		hooks.on('event', function(name, data){
			self.write("New event: " + name, data);
		});

	};
	
	this.stop = function(){
	  console.log('Shutting down Prey console...\n');
		this.unload();
		// this.emit('stopped');
	};
	
	this.unload = function(err){
		if(err) logger.error(err);
		if(this.prompt) this.prompt.close();
		process.stdin.destroy();
	};
	
	this.write = function(message, data){
		var str = data ? message + " received:\n\n" + JSON.stringify(data, null, 2) : message;
		console.log(str);
	};
	
	this.get_available_actions = function(){
		var actions = fs.readdirSync(common.root_path + '/lib/prey/plugins/actions');
		return actions.sort();
	};
	
	this.actions_list = function(){
		var str = "Available actions:\n";
		this.get_available_actions().forEach(function(action){
			str += "\t" + action + "\n";
		})
		return str;
	};
	
	this.get_available_getters = function(){
		var provider = require('./../../../provider_hub');
		var getters = [];
		for(getter in provider.getters){
			getters.push(getter);
		}
		return getters.sort();
	};
	
	this.getters_list = function(){
		var str = "Available getters:\n";
		this.get_available_getters().forEach(function(getter){
			str += "\t" + getter + "\n";
		})
		return str;
	}

	this.show_help = function(command){

		switch(command){
			
			case 'get':
				var str = "Gets [data] and returns it.\n\t";
				str += this.getters_list();
				break;

			case 'send':
				var str = "Fetches and sends that data somewhere.\n";
				str += "Syntax: send [data] to [endpoint] using [options_for_endpoint]\n";
				str += "Data can be a filename (full path required) or any of the getters below.\n\n";
				str += "Available endpoints are:\n";
				str += "\t- [url] (e.g. http://my.server.com/path)\n";
				str += "\t- [email] (e.g. youremail@gmail.com)\n";
				str += "\t- 'imgur'\n\n"
				str += this.getters_list();
				str += "\nSome examples:\n";
				str += "\t> send access_points_list to myemail@gmail.com\n";
				str += "\t> send screenshot to imgur using api_key:abcdef123456\n";
				str += "\t> send public_ip to http://api.server.com/v1 using username:hello password:x\n"
				break;

			case 'config':
				var str = "Sets or gets a config setting.";
				break;

			case 'start':
				var str = "Starts a new action.\n";
				str += this.actions_list();
				break;

			case 'stop':
				var str = "Stops a running action.";
				str += this.actions_list();
				break;

			default:
				var str = "Prey v" + common.version + " console driver.\nAvailable commands: \n";
				str += "\tversion\n";
				str += "\tconfig get [key]\n\tconfig set [key] (to) [value]\n";
				str += "\tget [info]\n\tsend [info] (to [destination])\n";
				str += "\tstart [action] (using [options])\n\tstop [action]";
				str += "\nFor more information, try with help [command], i.e. 'help send'";

		}

		this.write(str);
	};

	this.post = function(name, data){
		
		var destination = this.destinations[name];
		this.write("Sending " + name + " to " + destination.to + "...");
		
		if (typeof data == 'string'){
			var post_data = {};
			post_data[name] = data;
			data = post_data;
		}

		var callback = function(err, response_data){
			if(err) self.write("Unable to send data! " + err.toString());
			else self.write(response_data);
		};
		
		var merge_opts = function(key){
			var opts = destination.options || {};
			if(key) opts[key] = destination.to;
			return opts;
		};

		if(destination.to == 'imgur')
			dispatcher.send('imgur', data, merge_opts(), callback);
		else if(destination.to.match(this.email_regex))
			dispatcher.send('smtp', data, merge_opts('to'), callback);
		else if(destination.to.match(this.host_regex))
			dispatcher.send('http', data, merge_opts('url'), callback);
		else
			this.write("Unknown destination: " + destination.to) && this.paste(data);

		delete(this.destinations[name]);

	};

	this.parse_arguments = function(args){
		
		if(!args || args.trim() == '')
			return null;

		try{
			var formatted = args.trim().replace(/(\w+)/g,'"$1"').replace(/ /g, ',');
			return JSON.parse("{" + formatted + "}");
		} catch(e){
			this.write("Invalid argument format. Usage: start [action] foo:bar baz:100");
			return null;
		}
		
	};
	
	this.store_destination = function(context, destination, options){
		var opts = options.trim() == '' ? null : options;
		this.destinations[context] = {to: destination, options: opts};
	};
	
	this.parse_message = function(body){
				
		if(matches = body.match(/^help\s?(\w+)?/))
			return this.show_help(matches[1]);

		if(body.match(/^version/))
			return this.write("Prey v" + common.version);

		// if(body.match(/^update/))
			// return this.emit('update');

		if(matches = body.match(/config get (\w+)/))
			return this.write(matches[1], common.config[matches[1].trim()])

		if(matches = body.match(/config set (\w+) to (\w+)/))
			return this.emit('set', matches[1], matches[2]);

		if(matches = body.match(/start (\w+)(?: using )?(.*)/))
			return this.emit('start', matches[1], self.parse_arguments(matches[2]));

		if(matches = body.match(/stop (\w+)/))
			return this.emit('stop', matches[1]);

		if(matches = body.match(/(?:get|send) ([\w\/\.]+)(?: to )?([\w@\.:\/]+)?(.*)/)){

			if(matches[2]) this.store_destination(matches[1].trim(), matches[2].trim(), matches[3]);

			if(matches[1].trim() == 'report')
				return this.emit('start', 'report');

			else if(matches[1][0] == '/' && path.existsSync(matches[1].trim()))
				return this.post(matches[1].trim(), 
							{ file: {
								file: matches[1].trim(), 
								content_type: 'application/octet-stream'}
							})
			else
				return this.emit('get', matches[1].trim());

		}

		if(matches = body.match(/the (\w+)/))
			return this.write("What " + matches[1] + "?");

		this.write('Unknown command: ' + body);

	};


};

util.inherits(ConsoleDriver, Emitter);

var instance;

exports.load = function(options, callback){
	instance = new ConsoleDriver(options);
	instance.load();
	callback(null, instance); 
}

exports.unload = function(){
	instance.unload();
}