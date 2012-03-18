//////////////////////////////////////////
// Prey JS Desktop Plugin
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		logger = common.logger,
		util = require('util'),
		spawn = require('child_process').spawn,
		Tunnel = require('./../../../tunnel'),
		Emitter = require('events').EventEmitter,
		os_functions = require('./platform/' + common.os_name);

var RemoteDesktop = function(options){

	// ActionModule.call(this);
	var self = this;

	this.options = {
		vnc_port: options.vnc_port || 5900,
		vnc_pass: options.vnc_pass || 'secret',
		desktop_scale: options.desktop_scale || 2,
		view_only: options.view_only || true,
		tunnel_host: options.tunnel_host || 'kiwi',
		tunnel_port: options.tunnel_port || 9998
	}

	// open: first we open the tunnel, then we run the command
	// close: first we close the tunnel, then we kill the command

	this.start = function(){

		this.tunnel = new Tunnel(this.options.vnc_port, this.options.tunnel_host, this.options.tunnel_port);

		this.tunnel.on('opened', function(){

			logger.info("Tunnel for remote desktop is open!");

			var vnc_cmd = os_functions.vnc_command(self.options);
			self.child = spawn(vnc_cmd);

			self.child.on('exit', function(code){
				logger.info("VNC server terminated.");
				if(self.tunnel.is_open()) self.tunnel.close();
				// self.done();
			});

		});

		this.tunnel.on('closed', function(err){

			logger.info("Tunnel closed!");
			if(self.child)
				self.child.kill();

			this.emit('end', err);

		});

	}

	this.stop = function(){

		if(this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop
		else if(this.remote_desktop_command)
			this.remote_desktop_command.kill();

	}

};

util.inherits(RemoteDesktop, Emitter);

exports.start = function(options, callback){

	var desktop = this.desktop = new RemoteDesktop(options);
	desktop.start();

	setTimeout(function(){

		if(desktop.child && desktop.child.is_running())
			callback();
		else
			callback(new Error("Child command is not running."));

	}, 500); // wait a bit before checking if the command is running or not

	return desktop;

}

exports.stop = function(){
	this.desktop.stop();
}
