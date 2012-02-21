//////////////////////////////////////////
// Prey JS Terminal Module
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var common = require('./../../../common'),
		logger = common.logger,
		util = require('util'),
		Command = require('command'),
		Tunnel = require('./../../../tunnel'),
		emitter = require('events').EventEmitter,
		os_functions = require('./platform/' + common.os_name);

var RemoteTerminal = function(options){

	var self = this;
	this.options = {
		ssh_port: options.ssh_port || 22,
		tunnel_host: options.tunnel_host || 'kiwi',
		tunnel_port: options.tunnel_port || '9998'
	}

	this.start = function(){

		this.tunnel = new Tunnel(this.options.ssh_port, this.options.tunnel_host, this.options.tunnel_port);

		this.tunnel.on('opened', function(){

			logger.info("Tunnel for remote terminal is open!");

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

util.inherits(RemoteTerminal, emitter);

exports.start = function(options, callback){

	var terminal = this.terminal = new RemoteTerminal();
	terminal.start(options);

	setTimeout(function(){

		if(terminal.child && terminal.child.is_running())
			callback();
		else
			callback(new Error("Child command is not running."));

	}, 500); // wait a bit before checking if the command is running or not

	return terminal;

}

exports.stop = function(){
	this.terminal.stop();
}
