//////////////////////////////////////////
// Prey JS Terminal Module
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var common = require('./../../lib/prey/common'),
		logger = common.logger,
		util = require('util'),
		Command = require('command'),
		Tunnel = require('./../../lib/prey/tunnel'),
		emitter = require('events').EventEmitter,
		os_functions = require('./platform/' + common.os_name);

var Terminal = function(){

	var self = this;

	this.start = function(options){

		var ssh_port = options.ssh_port || 22;
		var tunnel_host = options.tunnel_host || 'kiwi';
		var tunnel_port = options.tunnel_port || '9998';

		this.tunnel = new Tunnel(ssh_port, tunnel_host, tunnel_port);

		this.tunnel.on('opened', function(){

			logger.info("Tunnel is open!");

			os_functions.ssh_server_running(function(running){

				if(!running) self.start_ssh_server();

			});

		});

		this.tunnel.on('closed', function(){

			logger.info("Tunnel closed!");

			if(self.child) // means we launched the ssh server
				self.shop_ssh_server();

			this.emit('end');

		});

	}

	this.start_ssh_server = function(){

		logger.info("Starting SSH server!");

		var ssh_cmd = os_functions.ssh_server_command;

		this.child = new Command(ssh_cmd);

		this.child.on('exit', function(code){
			logger.info("SSH server not running.");
			if(self.tunnel.is_open()) self.tunnel.close();
			// self.done();
		});

		this.child.on('error', function(e){
			logger.info('SSH server closed abruptly with status : ' + e.code);
			// console.log(e);
		});

//		self.remote_terminal_command.on('return', function(output){
//			console.log(output);
//		});

	};

	this.stop_ssh_server = function(){

		// TODO

	};

	this.stop = function(){

		if(this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop
		else if(this.child)
			this.stop_ssh_server();

	}

};

util.inherits(Terminal, emitter);

exports.start = function(options, callback){

	var terminal = this.terminal = new Terminal();
	terminal.start(options);

	setTimeout(function(){

		if(terminal.child && terminal.child.is_running())
			callback(this.terminal);
		else
			callback(false);

	}, 500); // wait a bit before checking if the command is running or not

}

exports.stop = function(){
	this.terminal.stop();
}
