//////////////////////////////////////////
// Prey JS FileBrowser Module
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('../../lib/common'),
		util = require('util'),
		connect = require('connect'),
		Tunnel = require('../../lib/tunnel'),
		ActionModule = require('../../lib/action_module');

var FileBrowser = function(){

	ActionModule.call(this);
	var self = this;
	this.name = 'filebrowser';

	this.options = {
		root_path: '/',
		show_hidden: false,
		tunnel_host: 'kiwi',
		tunnel_port: 9996
	}

	// open: first we open the tunnel, then we run the command
	// close: first we close the tunnel, then we kill the command

	this.start = function(callback){

		this.server = connect.createServer(
			connect.logger(),
			connect.directory(self.options.root_path),
			connect.static(self.options.root_path)
		);

		this.server.listen(function(){

			self.options.local_port = self.server.address().port;
			self.log("server listening on localhost:" + self.options.local_port);

			self.tunnel = new Tunnel(self.options.local_port, self.options.tunnel_host, self.options.tunnel_port);

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
		else if(this.server.state == 'open')
			this.server.close();

	}

};

util.inherits(FileBrowser, ActionModule);
module.exports = new FileBrowser();
