//////////////////////////////////////////
// Prey JS Discovery Object
// Written by Tomas Pollak
// (c) 2011, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var mdns = require('mdns'),
		dgram = require("dgram"),
		base = require('./base'),
		Network = require(base.modules_path + '/network');

var Discovery = {

	listen_port: 19191,
	listen_address: '0.0.0.0',
	local_clients: [],
	running: false,

	log: function(str){
		console.log(" -- [discovery] " + str);
	},

	advertise_service: function(){

		var type = 'udp';
		var ad = mdns.createAdvertisement(type, this.listen_port);
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

	get_client_info: function(){

		Network.get('active_network_interface', function(nic){

			this.client_info = {
				ip: nic.ip_address,
				mac: nic.mac_address
			}

		});

	},

	response_info_data: function(){
		return JSON.stringify({
			event: 'response_info',
			data: this.client_info
		});
	},

	handle_remote_message: function(data, peer){

		try {
			var message = JSON.parse(data);
		} catch(e) {
			return this.log("Malformed message received: " + data);
		}

		this.log("Got message: " + message.event + ", data: " + message.data);

		if(message.event == 'request_info' && this.client_info)
			this.send_message(this.response_info_data, peer.host, peer.port);
		else if(message.event == 'response_info')
			this.local_net_clients.push(message.data);
		else // if(message.event == 'command')
			this.server.emit('command', message.event, message.data);

	},

	start_service: function(callback){

		this.get_client_info();

		var server = dgram.createSocket("udp4");

		server.on("message", function(data, peer) {
			Discovery.log("Received: " + data + " from " + peer.address + ":" + peer.port);
			Discovery.handle_remote_message(data, peer);
		});

		server.on('error', function(err){
			console.log("Error: " + err.code);
		});

		server.on('close', function(err){
			console.log("Server closed.");
			Discovery.running = false;
		});

		server.on("listening", function() {
			var address = server.address();
			Discovery.log("Listener up on " + address.address + ":" + address.port);
			Discovery.advertise_service();
			Discovery.running = true;
			callback(server);
		});

		server.bind(this.listen_port, this.listen_address);
		this.server = server;

	},

	stop_service: function(){

		this.server.close();

	},

	check_client: function(host, port){

		this.send_message('request_info', host, port, function(err, bytes){

			self.log(bytes + " bytes sent to " + host);

		});

	},

	send_message: function(message, host, port, callback){

		if(typeof port == 'function'){
			var callback = port;
			var port = this.listen_port;
		}

		var socket = dgram.createSocket('udp4'),
				buffer = new Buffer(message);

		socket.on("error", function(err) {
			if(callback) callback(err);
		});

//			socket.on("message", function(data, peer) {
//				callback(null, data);
//			});

		this.log("Sending " + buffer.length + " byte message to " + host + " at " + port);

		socket.send(buffer, 0, buffer.length, port, host, function(err, bytes) {
			if(err) console.log(err);
			if(callback) callback(err, bytes);
			socket.close();
		});

	}

}

module.exports = Discovery;
