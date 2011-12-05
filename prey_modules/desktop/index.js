//////////////////////////////////////////
// Prey JS Desktop Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('../../core/base'),
		util = require('util'),
		Command = require('command'),
		Tunnel = require('../../core/tunnel'),
		ActionModule = require('../../core/action_module'),
		os_functions = require('./platform/' + base.os_name);

var Desktop = function(){

	ActionModule.call(this);
	var self = this;
	this.name = 'desktop';

	this.options = {
		vnc_port: 5900,
		vnc_pass: 'secret',
		desktop_scale: 2,
		view_only: true,
		tunnel_host: 'kiwi',
		tunnel_port: 9999
	}

	// open: first we open the tunnel, then we run the command
	// close: first we close the tunnel, then we kill the command

	this.start = function(callback){

		this.tunnel = new Tunnel(this.options.vnc_port, this.options.tunnel_host, this.options.tunnel_port);

		this.tunnel.on('opened', function(){

			self.log("Tunnel is open!");

			var vnc_cmd = os_functions.vnc_command(self.options);
			// console.log("running: " + vnc_cmd);
			self.child = new Command(vnc_cmd);

			self.child.on('exit', function(code){
				self.log("VNC server terminated.");
				if(self.tunnel.is_open()) self.tunnel.close();
				// self.done();
			});

			self.child.on('error', function(e){
				self.log('VNC server closed abruptly with status code ' + e.code);
				// console.log(e);
			});

//			self.child.on('return', function(output){
//				console.log(output);
//			});

		});

		this.tunnel.on('closed', function(){

			self.log("Tunnel closed!");
			if(self.child)
				self.child.kill();

			self.done();

		});

		setTimeout(function(){

			if(this.child)
				callback(this.child.is_running());
			else
				callback(false);

		}, 500); // wait a bit before checking if the command is running or not

	}

	this.stop = function(){

		if(this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop
		else if(this.remote_desktop_command)
			this.remote_desktop_command.kill();

	}

};

util.inherits(Desktop, ActionModule);

exports.init = function(options){
	return new Desktop(options);
}
