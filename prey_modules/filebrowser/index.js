//////////////////////////////////////////
// Prey JS FileBrowser Plugin
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../lib/common'),
		util = require('util'),
		connect = require('connect'),
		Tunnel = require('../../lib/tunnel'),
		emitter = require('events').EventEmitter;

var FileBrowser = function(){

	var self = this;

	// open: first we open the tunnel, then we run the command
	// close: first we close the tunnel, then we kill the command

	this.start = function(options, callback){

		var tunnel_host = options.tunnel_host || 'kiwi';
		var tunnel_port = options.tunnel_port || 9996;

		var static_root_path = options.static_root_path || '/';
		var directory_options = {
			hidden: options.show_hidden || false,
			icons: options.show_icons || true
		}

		this.server = connect.createServer(
			connect.logger(),
			connect.directory(static_root_path, directory_options),
			connect.static(static_root_path)
		);

		this.server.listen(function(){

			var local_port = self.server.address().port;
			self.log("server listening on localhost:" + local_port);

			self.tunnel = new Tunnel(local_port, tunnel_host, tunnel_port);

			self.tunnel.on('error', function(){
				self.stop();
			});

			self.tunnel.on('opened', function(){
				self.log("Tunnel is open!");
			});

			self.tunnel.on('closed', function(){

				self.log("Tunnel closed!");
				self.server.close();

			});

		});

		callback(this.server.readyState == 'open');

	}

	this.stop = function(){

		if(this.tunnel.is_open())
			this.tunnel.close();
		else if(this.server.readyState == 'open')
			this.server.close();

	}

};

util.inherits(FileBrowser, emitter);

exports.start = function(options, callback){
	var filebrowser = this.filebrowser = new FileBrowser();
	filebrowser.start(options, callback);
}

exports.stop = function(){
	this.filebrowser.stop();
}
