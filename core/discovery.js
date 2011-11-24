//////////////////////////////////////////
// Prey Discovery Object
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var mdns = require('mdns'),
		dgram = require("dgram");

var discovery_port = 19191;

var Discovery = {

	local_clients: [],

	log: function(str){
		console.log(" -- [discovery] " + str);
	},

	advertise_service: function(type, port){

		var ad = mdns.createAdvertisement(type, discovery_port);
		ad.start();

	},

	find_clients: function(){

		var browser = mdns.createBrowser('udp');
		browser.on('serviceUp', function(info, flags) {
			Discovery.log("Up: " + util.inspect(info));
			Discovery.check_client(info.host, info.port);
		});
		browser.on('serviceDown', function(info, flags) {
			Discovery.log("Down: " + util.inspect(info));
		});

	},

	handle_remote_message: function(data, peer){

		var message = JSON.parse(data);
		this.log("Got message: " + message.event + ", data: " + message.data);

		if(message.event == 'request_info')
			this.message_client({event: 'response_info', data: {version: this.version}}, peer.host, peer.port);
		else if(message.event == 'response_info')
			this.local_net_clients.push(message.data);
		else // if(message.event == 'command')
			this.server.emit('command', message.event, message.data);

	},

	start_service: function(callback){

		var listen_address = '0.0.0.0';
		var server = dgram.createSocket("udp4");

		server.on("message", function(data, peer) {
			Discovery.log("server got: " + data + " from " + peer.address + ":" + peer.port);
			Discovery.handle_remote_message(data, peer);
		});

		server.on('error', function(err){
			console.log(" !! Error: " + err.code);
		});

		server.on("listening", function() {
			var address = server.address();
			Discovery.log("server listening on " + address.address + ":" + address.port);
			Discovery.advertise_service('udp', discovery_port);
			callback(server);
		});

		server.bind(discovery_port, listen_address);
		this.server = server;

	},

	check_client: function(host, port){

		this.message_client('request_info', host, port, function(err, bytes){

			self.log(bytes + " bytes sent to " + host);

		});

	},

	message_client: function(message, host, port, callback){

		var socket = dgram.createSocket('udp4'),
				buffer = new Buffer(JSON.stringify(message));

		if(callback){

			socket.on("error", function(err) {
				callback(err);
			});

//			socket.on("message", function(data, peer) {
//				callback(null, data);
//			});

		}

		socket.send(buffer, 0, buffer.length, port, host, function(err, bytes) {
			if(err) console.log(err);
			if(callback) callback(err, bytes);
			socket.close();
		});

	}

}

module.exports = Discovery;
