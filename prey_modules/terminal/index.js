//////////////////////////////////////////
// Prey JS Terminal Module
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var base = require('../../core/base'),
		util = require('util'),
		Tunnel = require('../../core/tunnel'),
		Command = require('../../core/command'),
		ActionModule = require('../../core/action_module'),
		os_functions = require('./platform/' + base.os_name);

var Terminal = function(){

	ActionModule.call(this);
	var self = this;
	this.name = 'terminal';

	this.options = {
		ssh_port: 22,
		tunnel_host: 'kiwi',
		tunnel_port: 9998
	}

	this.start = function(){

		this.tunnel = new Tunnel(this.options.ssh_port, this.options.tunnel_host, this.options.tunnel_port);

		this.tunnel.on('opened', function(){

			self.log("Tunnel is open!");

			os_functions.ssh_server_running(function(running){

				if(!running) self.start_ssh_server();

			});

		});

		this.tunnel.on('closed', function(){

			self.log("Tunnel closed!");

			if(self.remote_terminal_command) // means we launched the ssh server
				self.shop_ssh_server();

			self.done();

		});

	}

	this.start_ssh_server = function(){


		console.log("Starting SSH server!");

		var ssh_cmd = os_functions.ssh_server_command;

		this.remote_terminal_command = new Command(ssh_cmd);

		if (self.remote_terminal_command.is_running())
			self.log("SSH server is running!");

		self.remote_terminal_command.on('exit', function(code){
			self.log("SSH server not running.");
			if(self.tunnel.is_open()) self.tunnel.close();
			// self.done();
		});

		self.remote_terminal_command.on('error', function(e){
			self.log('SSH server closed abruptly with status : ' + e.code);
			// console.log(e);
		});

//		self.remote_terminal_command.on('return', function(output){
//			console.log(output);
//		});

	};

	this.stop_ssh_server = function(){

		// todo

	};

	this.stop = function(){

		if(this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop
		else if(this.remote_terminal_command)
			this.stop_ssh_server();

	}

};

util.inherits(Terminal, ActionModule);
module.exports = new Terminal();
