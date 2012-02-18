//////////////////////////////////////////
// Prey Console Driver
// Written by Tomas Pollak
// (c) 2011, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var util = require('util'),
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

	this.show_help = function(){
		var str = "Available commands: \n\tversion\n\tupdate\n\tset [key] [value]\n\tget [info]";
		str += "\n\tstart [action]\n\tstop [action]";
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
				
		if(body.match(/^help/))
			return this.show_help();

		if(body.match(/^version/))
			return this.write("Prey v" + common.version);

		if(body.match(/^update/))
			return this.emit('update');

		if(matches = body.match(/set (\w+) to (\w+)/))
			return this.emit('set', matches[1], matches[2]);

		if(matches = body.match(/start (\w+)(.*)/))
			return this.emit('start_action', matches[1], self.parse_arguments(matches[2]));

		if(matches = body.match(/stop (\w+)/))
			return this.emit('stop_action', matches[1]);

		if(matches = body.match(/(?:get|send) (\w+)(?: to )?([\w@\.:\/]+)?(.*)/)){

			if(matches[2]) this.store_destination(matches[1].trim(), matches[2].trim(), matches[3]);

			if(matches[1].trim() == 'report')
				return this.emit('start_action', 'report');
			else
				return this.emit('get_info', matches[1].trim());
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