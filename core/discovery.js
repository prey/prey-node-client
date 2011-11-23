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

		if(message.event == 'request')
			this.message_client({event: 'response', data: {version: this.version}}, peer.host, peer.port);
		else if(message.event == 'response')
			this.local_net_clients.push(message.data);

	},

	start_service: function(){

		var listen_address = '0.0.0.0';
		var server = dgram.createSocket("udp4");

		server.on("message", function (data, peer) {
			Discovery.log("server got: " + data + " from " + peer.address + ":" + peer.port);
			Discovery.handle_remote_message(data, peer);
		});

		server.on("listening", function () {
			var address = server.address();
			Discovery.log("server listening on " + address.address + ":" + address.port);
		});

		server.bind(discovery_port, listen_address, function(){
			Discovery.advertise_service('udp', discovery_port);
			callback(server);
		});

		this.server = server;

	},

	check_client: function(host, port){

		this.message_client('request', host, port, function(err, message){

			if(message) Discovery.handle_remote_message(message);

		});

	},

	message_client: function(message, host, port, callback){

		var socket = dgram.createSocket('udp4'),
				buffer = new Buffer(JSON.stringify(message));

		if(callback){

			socket.on("error", function(err) {
				callback(err);
			});

			socket.on("message", function(data) {
				callback(null, data);
			});

		}

		socket.send(buffer, 0, buffer.length, port, host, function(err, message) {
			if(err && callback) callback(err);
		});

	}

}

module.exports = Discovery;
