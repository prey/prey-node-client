"use strict";

//////////////////////////////////////////
// Prey JS Terminal Module
// (c) 2011, Fork Ltd. -- forkhq.com
// Written by Tomás Pollak
// Licensed under the GPLv3
//////////////////////////////////////////

var util    = require('util'),
		Emitter = require('events').EventEmitter,
    common  = require('./../../common'),
		Tunnel  = require('./../../tunnel'),
		os_functions = require('./' + common.os_name),
		logger  = common.logger;

var RemoteTerminal = function(options) {

	var self = this;
	var options = options || {};

	this.ssh_server_stated = false;
	this.ssh_port = options.ssh_port || 22;
	this.tunnel_host = options.host || 'localhost',
	this.tunnel_port = options.port || '9998';

	this.start = function(callback) {

		var self = this,
		    opened = false;

		this.tunnel = new Tunnel(this.ssh_port, this.tunnel_host, this.tunnel_port);

		this.tunnel.on('opened', function() {
			opened = true;
			logger.info("Tunnel for remote terminal is open!");

			os_functions.ssh_server_running(function(running){
			  if (running) return callback(null, self);

				self.start_ssh_server(function(err){
				  if (err) return callback(err);
				  callback(null, self);
				});
			});

		});

		this.tunnel.on('closed', function(err) {
			logger.info("Tunnel closed!");
			if (!opened) callback(err || new Error("Unable to connect."));
			self.stop(err);
		});
	};

	this.start_ssh_server = function(cb) {
		logger.info("Starting SSH server!");
		os_functions.start_ssh_server(function(err) {
			if (err) return cb(err);
			self.ssh_server_started = true;
			logger.info("SSH server online!");
			cb();
		});
	};

	this.stop_ssh_server = function() {
		if (!this.ssh_server_started) return;
		logger.info("Stopping SSH server!");
		os_functions.stop_ssh_server(function(err) {
			if (err) logger.error("Could not stop SSH server.");
			else logger.info("SSH server down.");
		});
		this.ssh_server_started = false;
	};

	this.stop = function() {
		if (this.tunnel.is_open())
			this.tunnel.close(); // will trigger remote desktop command to stop

		if (this.ssh_server_started)
			this.stop_ssh_server();

		this.emit('end');
	};
};

util.inherits(RemoteTerminal, Emitter);

exports.start = function(options, callback) {
	this.terminal = new RemoteTerminal(options);
	this.terminal.start(callback);
};

exports.stop = function() {
	this.terminal.stop();
};
