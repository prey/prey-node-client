"use strict";

//////////////////////////////////////////
// Prey JS FileBrowser Plugin
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var util = require('util'),
    connect = require('connect'),
    Emitter = require('events').EventEmitter,
    Tunnel  = require('./../../tunnel'),
    common  = require('./../../common');

var FileBrowser = function(options){

	var self = this;
	this.options = options;

	this.tunnel_host = options.host || 'tunnels.preyproject.com';
	this.tunnel_port = options.port || 9996;

	// open: first we open the tunnel, then we run the command
	// close: first we close the tunnel, then we kill the command

	this.start = function(callback){

    var rp = (common.os_name === 'windows') ? "c:\\" : process.env.HOME;
		var root_path = this.options.root_path || rp;

		var directory_options = {
			hidden: this.options.show_hidden || false,
			icons: this.options.show_icons || true
		};

		this.server = connect()
									.use(connect.logger())
									.use(connect.directory(root_path, directory_options))
									.use(connect.static(root_path));

		this.server.listen(function(err){
		  if (err) return callback(err);

			var server = this;

			var local_port = server.address().port;
			common.logger.info("Filebrowser HTTP server listening on localhost:" + local_port);

			self.tunnel = new Tunnel(local_port, self.tunnel_host, self.tunnel_port);

			self.tunnel.on('error', function(err){
				self.stop(err);
			});

			self.tunnel.on('opened', function(){
				common.logger.info("Tunnel is open!");
			});

			self.tunnel.on('closed', function(){
				common.logger.info("Tunnel closed!");
				server.close();
			});

			callback(err, self);
		});

	};

	this.stop = function(err){

		if(this.tunnel.is_open())
			this.tunnel.close();
		else if(this.server.readyState === 'open')
			this.server.close();

		this.emit('end');

	};

};

util.inherits(FileBrowser, Emitter);

var instance;

exports.start = function(options, callback){
	instance = new FileBrowser(options);
	instance.start(callback);
};

exports.stop = function(){
	instance.stop();
};
