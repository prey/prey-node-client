//////////////////////////////////////////
// Prey JS FileBrowser Plugin
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./../../../common'),
		util = require('util'),
		connect = require('connect'),
		Tunnel = require('./../../../tunnel'),
		Emitter = require('events').EventEmitter;

var Filebrowser = function(options){

	var self = this;
	this.options = options;

	// open: first we open the tunnel, then we run the command
	// close: first we close the tunnel, then we kill the command

	this.start = function(){

		var tunnel_host = this.options.tunnel_host || 'kiwi';
		var tunnel_port = this.options.tunnel_port || 9996;

		var static_root_path = this.options.static_root_path || '/';
		var directory_options = {
			hidden: this.options.show_hidden || false,
			icons: this.options.show_icons || true
		}

		this.server = connect.createServer(
			connect.logger(),
			connect.directory(static_root_path, directory_options),
			connect.static(static_root_path)
		);

		this.server.listen(function(){

			var local_port = self.server.address().port;
			common.logger.info("server listening on localhost:" + local_port);

			self.tunnel = new Tunnel(local_port, tunnel_host, tunnel_port);

			self.tunnel.on('error', function(){
				self.stop();
			});

			self.tunnel.on('opened', function(){
				common.logger.info("Tunnel is open!");
			});

			self.tunnel.on('closed', function(){

				common.logger.info("Tunnel closed!");
				self.server.close();

			});

		});

	}

	this.stop = function(){

		if(this.tunnel.is_open())
			this.tunnel.close();
		else if(this.server.readyState == 'open')
			this.server.close();

		this.emit('end');

	}

};

util.inherits(Filebrowser, Emitter);

var instance;

exports.start = function(options, callback){
	instance = new Filebrowser(options);
	try{
		instance.start();
		callback();
	} catch(e){
		callback(e);
	}
	return instance;
}

exports.stop = function(){
	instance.stop();
}