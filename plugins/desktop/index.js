//////////////////////////////////////////
// Prey JS Desktop Plugin
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../lib/common'),
		logger = common.logger,
		util = require('util'),
		Command = require('command'),
		Tunnel = require('../../lib/tunnel'),
		emitter = require('events').EventEmitter,
		os_functions = require('./platform/' + common.os_name);

var Desktop = function(){

	// ActionModule.call(this);
	var self = this;

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

	this.start = function(options){

		var vnc_port = options.vnc_port || 5900;
		var tunnel_host = options.tunnel_host || 'kiwi';
		var tunnel_port = options.tunnel_port || '9998';

		this.tunnel = new Tunnel(vnc_port, tunnel_host, tunnel_port);

		this.tunnel.on('opened', function(){

			logger.info("Tunnel is open!");

			var vnc_cmd = os_functions.vnc_command(self.options);
			// console.log("running: " + vnc_cmd);
			self.child = new Command(vnc_cmd);

			self.child.on('exit', function(code){
				logger.info("VNC server terminated.");
				if(self.tunnel.is_open()) self.tunnel.close();
				// self.done();
			});

			self.child.on('error', function(e){
				logger.info('VNC server closed abruptly with status code ' + e.code);
				// console.log(e);
			});

//			self.child.on('return', function(output){
//				console.log(output);
//			});

		});

		this.tunnel.on('closed', function(){

			logger.info("Tunnel closed!");
			if(self.child)
				self.child.kill();

			this.emit('end', true);

		});

	}

	this.stop = function(){

		if(this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop
		else if(this.remote_desktop_command)
			this.remote_desktop_command.kill();

	}

};

util.inherits(Desktop, emitter);

exports.start = function(options, callback){

	var desktop = this.desktop = new Desktop();

	desktop.start(options);

	setTimeout(function(){

		if(desktop.child && desktop.child.is_running())
			callback(desktop);
		else
			callback(false);

	}, 500); // wait a bit before checking if the command is running or not

}

exports.stop = function(){
	this.desktop.stop();
}
