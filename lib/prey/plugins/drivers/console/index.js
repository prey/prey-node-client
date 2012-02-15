var util = require('util'),
		common = require('./../../../common'),
 		readline = require('readline'),
		hooks = require('./../../../hook_dispatcher'),
		Emitter = require('events').EventEmitter;

var ConsoleDriver = function(){

	var self = this;
	
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
			self.send(name, data);
			self.prompt.prompt();
		});
		
		hooks.on('event', function(name, data){
			self.send("New event: " + name, data);
		});

	};
	
	this.stop = function(){
	  console.log('Shutting down Prey console...\n');
		this.unload();
		// this.emit('stopped');
	};
	
	this.unload = function(){
		if(this.prompt) this.prompt.close();
		process.stdin.destroy();
	};
	
	this.send = function(message, data){
		var str = data ? message + " received:\n\n" + JSON.stringify(data, null, 2) : message;
		console.log(str);
	};

	this.show_help = function(){
		var str = "Available commands: \n\tversion\n\tupdate\n\tset [key] [value]\n\tget [info]";
		str += "\n\tstart [action]\n\tstop [action]";
		this.send(str);
	};
	
	this.parse_arguments = function(args){
		
		if(!args || args.trim() == '')
			return null;

		try{
			var formatted = args.trim().replace(/(\w+)/g,'"$1"').replace(/ /g, ',');
			return JSON.parse("{" + formatted + "}");
		} catch(e){
			this.send("Invalid argument format. Usage: start [action] foo:bar baz:100");
			return null;
		}
		
	};
	
	this.parse_message = function(body){
				
		if(body.match(/^help/))
			return this.show_help();

		if(body.match(/^version/))
			return this.send("Prey v" + common.version);

		if(body.match(/^update/))
			return this.emit('update');

		if(matches = body.match(/^set (\w+)(.*)/))
			return this.emit('set', matches[1], matches[2]);

		if(matches = body.match(/^start (\w+)(.*)/))
			return this.emit('start_action', matches[1], this.parse_arguments(matches[2]));

		if(matches = body.match(/^stop (\w+)/))
			return this.emit('stop_action', matches[1]);

		if(matches = body.match(/[get|send] report(?: to )?(.*)/))
			return this.emit('start_action', 'report');

		if(matches = body.match(/[get|send] (\w+)(?: to )?(.*)/))
			return this.emit('get_info', matches[1]);

		this.send('Unknown command: ' + body);

	};


};

util.inherits(ConsoleDriver, Emitter);
module.exports = new ConsoleDriver();