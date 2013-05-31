"use strict";

//////////////////////////////////////////
// Prey JS Desktop Plugin
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
		spawn = require('child_process').spawn,
		Emitter = require('events').EventEmitter,
                common = require('./../../common'),
		Tunnel = require('./../../tunnel'),
		os_functions = require('./' + common.os_name),
		logger = common.logger;

var RemoteDesktop = function(options){

	var self = this;
	var options = options || {};

	this.vnc_opts = {
		port: options.vnc_port || 5900,
		pass: options.vnc_pass || 'secret',
		desktop_scale: options.desktop_scale || 2,
		view_only: options.view_only || true
	};

	this.tunnel_host = options.host || 'localhost';
	this.tunnel_port = options.port || 9999;

	// open: first we open the tunnel, then we run the command
	// close: first we close the tunnel, then we kill the command

	this.start = function(callback){

		var self = this,
		    opened = false;

		this.tunnel = new Tunnel(this.vnc_opts.port, this.tunnel_host, this.tunnel_port);

		this.tunnel.on('opened', function(){

			opened = true;
			logger.info("Tunnel for remote desktop is open!");

			os_functions.vnc_server_running(function(running){
			  if (running) return callback(null, self);

				self.start_vnc_server(function(err){
				  if (err) return callback(err);
          callback(null, self);
				});
			});

		});

		this.tunnel.on('closed', function(err){
			logger.info("Tunnel closed!");

			if (!opened)
			  callback(err || new Error("Unable to connect."));

			self.stop(err);
		});

	};

	this.start_vnc_server = function(cb){

		logger.info("Starting VNC server...");

		var vnc_cmd = os_functions.vnc_command(this.vnc_opts);
		var split = vnc_cmd.split(' ');

		self.child = spawn(split.shift(), split);

		self.child.on('exit', function(code){
			logger.info("VNC server terminated.");
			self.stop();
		});

		setTimeout(function(){
			os_functions.vnc_server_running(function(running){
				if (!running)
					return cb(new Error("Couldn't start VNC server. Is TightVNC/x11vnc installed?"));

				logger.info('VNC server up.')
				self.vnc_server_started = true;
				cb();
			});
		}, 500);

	};

	this.stop_vnc_server = function(){

		if(!this.vnc_server_started) return;

		logger.info("Stopping VNC server...");

		if(this.child) this.child.kill();
		this.vnc_server_started = false;

	};

	this.stop = function(err){

		if (this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop

		if (this.vnc_server_started)
			this.stop_vnc_server();

			this.emit('end', err);
	};

};

util.inherits(RemoteDesktop, Emitter);

exports.start = function(options, callback){

	this.desktop = new RemoteDesktop(options);
	this.desktop.start(callback);

};

exports.stop = function(){
	this.desktop.stop();
};
