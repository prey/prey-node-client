//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'), tls = require('tls'), sys = require('sys'), events = require('events');

// to generate:
// openssl genrsa -out ssl/key.pem 1024
// openssl req -new -key ssl/key.pem -out ssl/csr.pem
// openssl x509 -req -in ssl/csr.pem -signkey ssl/key.pem -out ssl/cert.pem

var private_key_file = 'ssl/key.pem';
var certificate_file = 'ssl/cert.pem';

var keys = {
	key: fs.readFileSync(private_key_file).toString(),
	cert: fs.readFileSync(certificate_file).toString()
};

var OnDemand = {

	stream: null,
	connected: false,

	connect: function(host, port, config, version){

		var self = this;

		// create and encrypted connection using ssl
		self.stream = tls.connect(port, host, keys, function(){

			console.log("Connection established.");
			if(self.stream.authorized)console.log("Credentials were valid!");

			self.connected = true;
			self.register(config, version);
			self.stream.setEncoding('utf8');

		});

		self.stream.on("data", function(data){
			console.log("Data received:" + data);
			var msg = JSON.parse(data);
			if(msg.event == "ping")
				self.pong();
			else
				stream.emit('event', msg.event, msg.data);
		})

		self.stream.on("error", function(error){
			console.log(error.message);
			self.stream.end();
		})

		self.stream.on("end", function(){
			console.log("Connection ended");
		})

		self.stream.on("close", function(had_error){
			console.log("Connection closed.")
		});

		return self.stream;

	},

	register: function(config, version){
		console.log("Registering...");
		var data = {
			client_version: version,
			key: config.device_key,
			group: config.api_key,
			protocol: 1
		}
		this.send('connecxxt', data)
	},

	pong: function(){
		var data = {
			timestamp: Date.now().toString()
		}
		this.send('ping', data)
	},

	send: function(action, data){
		console.log("Sending action " + action);
		this.stream.write(JSON.stringify({ action: action, data: data }))
	}

}

// sys.inherits(OnDemand, events.EventEmitter);

exports.connect = function(host, port, config, version){
	return OnDemand.connect(host, port, config, version);
}

exports.connected = function(){
	return OnDemand.connected;
}
