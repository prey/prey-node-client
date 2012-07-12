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
		message_parser = require('./message_parser').parse,
		Emitter = require('events').EventEmitter;

var ConsoleDriver = function(options){

	var self = this;
	this.name = 'console';
	this.destinations = {};
	this.combos = {};
	this.options = options;

	this.email_regex = /^\w+@[a-zA-Z_]+?\.[a-zA-Z]{2,3}$/;
	this.host_regex = /[a-zA-Z0-9\-\.]+\.[a-zA-Z]{2,3}/;

	this.load = function(){
		this.load_prompt();
		this.load_hooks();
		this.emit('loaded');
		if(!common.program.debug) common.logger.off();
	};

	this.bold = function(str){
		return "\033[1m" + str + "\033[0m";
	}

	this.red = function(str){
		return "\033[1;31m" + str + "\033[0m";
	}

	this.load_prompt = function(){

 		var rl = this.prompt = readline.createInterface(process.stdin, process.stdout);
		var prefix = this.bold('prey>') + ' ';
		var prefix_length = 6;

		rl.on('line', function(line){

			if(line.trim() == 'quit' || line.trim() == 'exit')
				return rl.close();

			if(line.trim() != '')
				self.parse_message(line.trim());

			rl.setPrompt(prefix, prefix_length);
			rl.prompt();

		});

		rl.on('close', function() {
		  self.stop();
		});

		setTimeout(function(){

			console.log('\nWelcome back, master. Type "help" for assistance.\n');

			rl.setPrompt(prefix, prefix_length);
			rl.prompt();

		}, 300);

	};

	this.load_hooks = function(){

		hooks.on('data', function(name, data){

			if(self.destinations[name]) // if we were asked for another destination
				self.post(name, data);
			else
				self.paste(name, data);

			if(self.prompt) self.prompt.prompt();
		});

		hooks.on('error', function(err){
			self.say(self.red(err));
		})

		hooks.on('event', function(event_name, data){
			if(data && data.stack) // error
				return self.say(data.toString())
			else
				self.say("New event: " + event_name, data);

			if(self.combos[event_name]) self.parse_message(self.combos[event_name], true);
			delete self.combos[event_name];

		});

	};

	this.stop = function(){
	  console.log('\nShutting down Prey console...\n');
		this.unload();
		// this.emit('stopped');
	};

	this.unload = function(err){
		if(err) logger.error(err);
		if(this.prompt) this.prompt.close();
		process.stdin.destroy();
		common.logger.on();
	};

	this.say = function(message, data){
		var str = data ? message + " received:\n\n" + JSON.stringify(data, null, 2) : message;
		console.log(str);
	};

	this.paste = function(message, data){
		this.say(message, data);
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
		var providers_list = require('./../../../providers').map();
		return Object.keys(providers_list).sort();
	};

	this.get_available_reports = function(){
		var reports_list = require('./../../../reports').map();
		return Object.keys(reports_list).sort();
	};

	this.getters_list = function(){
		var str = "Available getters:\n";
		this.get_available_getters().forEach(function(name){
			str += "\t" + name + "\n";
		})
		return str;
	};

	this.reports_list = function(){
		var str = "Available reports:\n";
		this.get_available_reports().forEach(function(name){
			str += "\t" + name + "\n";
		})
		return str;
	};

	this.get_help_message = function(command){

		switch(command){

			case 'on':
				var str = "Do something in the event something happens. Usually you would set up the hook\n";
				str +=    "and then start the action that will trigger that hook.\n\n";
				str +=    "Syntax: on [event_name] [start|stop|get|send] [what] [options]\n"
				str +=    "\nExamples:\n\n";
				str +=    "\t> on failed_unlock_attempt send screenshot to myemail@gmail.com (and then 'start lock')\n";
				str +=    "\t> on alarm_start send picture to imgur using api_key:x (and then 'start alarm')\n";
				str +=    "\t> on report_finished start geofencing (and then 'start report')\n";
				str +=    "\t> on tap_detected start lock (and then 'start sound-detector')\n";
				break;

			case 'get':
				var str = "Gets [data] and returns it.\n\n";
				str += this.getters_list();
				str += "\n";
				str += this.reports_list();
				break;

			case 'send':
				var str = "Fetches and sends that data somewhere.\n\n";
				str += "Syntax: send [data] to [endpoint] using [options_for_endpoint]\n";
				str += "Data can be a filename (full path required) or any of the getters below.\n\n";
				str += "Available endpoints:\n";
				str += "\t- [url] (e.g. http://my.server.com/path)\n";
				str += "\t- [email] (e.g. youremail@gmail.com)\n";
				str += "\t- imgur (requires passing api_key in options)\n\n"
				str += this.getters_list();
				str += "\nSome examples:\n";
				str += "\t> send access_points_list to myemail@gmail.com\n";
				str += "\t> send screenshot to imgur using api_key:abcdef123456\n";
				str += "\t> send public_ip to http://api.server.com/v1 using username:hello password:x\n"
				break;

			case 'config':
				var str = "Sets or gets a config setting.";
				break;

			case 'show':
				var str = "Shows info about a specific action.\n\n";
				break;

			case 'start':
				var str = "Starts a new action.\n\n";
				str += this.actions_list();
				break;

			case 'stop':
				var str = "Stops a running action.\n\n";
				str += this.actions_list();
				break;

			default:
				var str = "Prey v" + common.version + " " + this.name + " driver.\n\nAvailable commands: \n\n";
				str += "\tconfig get [key]\n";
				str += "\tconfig set [key] to [value]\n";
				str += "\tget [data]\n";
				str += "\tsend [data] (to [destination]) (using [options])\n";
				str += "\tstart [action] (using [options])\n";
				str += "\tstop [action]\n";
				str += "\ton [event_name] [start|stop|get|set] [options] ...\n"
				str += "\tquit";
				str += "\n\nFor more information, try with help [command], i.e. 'help send'";

		}

		return str;
	};

	this.show_help = function(command){
		var str = this.get_help_message(command);
		this.paste(str);
	};

	this.send_file = function(file){
		this.post(file, {file: file, content_type: 'application/octet-stream'});
	};

	this.get_config = function(key){
		var value = common.config[matches[1].trim()];
		if(value && typeof value != 'undefined')
			this.say('config: ' + key, value);
		else
			this.say("Error: Invalid config key: " + key);
	}

	this.post = function(name, data){

		var destination = this.destinations[name];
		this.say("Sending " + name + " to " + destination.to + "...");

		if (typeof data == 'string'){
			var post_data = {};
			post_data[name] = data;
			data = post_data;
		} else if(data.file && data.content_type){
			data = {
				file: {file: data.file, content_type: data.content_type}
			}
		}

		var callback = function(err, response_data){
			if(err) return self.say("Unable to send data! " + err.toString());

			if(response_data.subject) // email
				self.say("Email successfully sent. Check your inbox. :)");
			else
				self.paste(response_data);
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
			this.say("Unknown destination: " + destination.to) && this.paste(data);

		delete(this.destinations[name]);

	};

	// transforms this "host:myhost.com user:god"
	// into this: {host: 'myhost.com', user: 'god' }
	this.parse_arguments = function(args){

		if(!args || args.trim() == '') return;

		try{
			var formatted = args.trim().replace(/([\w\.]+)/g,'"$1"').replace(/ /g, ',');
			return JSON.parse("{" + formatted + "}");
		} catch(e){
			this.say("Invalid argument format.");
			return null;
		}

	};

	this.store_destination = function(context, destination, options){
		var opts = options.trim() == '' ? null : this.parse_arguments(options);
		this.destinations[context] = {to: destination, options: opts};
	};

	this.add_hook = function(when, event, body){

		var command = body.replace([when, event].join(' '), '').trim()
		this.combos[event] = command;

		// hooks[when](event, function(name, data){
			// self.parse_message()
		// });

		this.say("Initialized hook for " + event);

	}

	this.parse_message = message_parser;

};

util.inherits(ConsoleDriver, Emitter);
exports.ConsoleDriver = ConsoleDriver;

var instance;

exports.load = function(options, callback){
	instance = new ConsoleDriver(options);
	instance.load();
	callback(null, instance);
}

exports.unload = function(){
	instance.unload();
}
