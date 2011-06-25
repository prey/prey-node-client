//////////////////////////////////////////
// Prey Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		tls = require('tls'),
		path = require('path'),
		sys = require('sys'),
		util = require('util');

// to generate, run ./ssl/generate.sh
var private_key_file = 'ssl/ssl.key';
var certificate_file = 'ssl/ssl.cert';

var OnDemand = {

	stream: null,
	keys: null,
	connected: false,

	start: function(host, port, config, version, callback){
		this.self = this;

		this.get_keys(function(){
			OnDemand.connect(host, port, config, version, callback);
		});

	},

	get_keys: function(callback){
		if(OnDemand.keys == null){
			if(!path.existsSync(private_key_file)){
				console.log(" !! Keys not found! Generating...");
				this.keys = true;
				require('child_process').exec('ssl/generate.sh', function(error, stdout, error){
					console.log(stdout);
					if(!error) OnDemand.read_keys(callback);
				});
			} else OnDemand.read_keys(callback);
		}
	},

	read_keys: function(callback){

		util.debug("Reading keys...");

		this.keys = {
			key: fs.readFileSync(private_key_file).toString(),
			cert: fs.readFileSync(certificate_file).toString()
		};

		callback();

	},

	connect: function(host, port, config, version, callback){

		// create and encrypted connection using ssl
		self.stream = tls.connect(4790, 'localhost', this.keys, function(){

			console.log(" -- Connection established.");
			self.stream.authorized ? util.debug("Credentials were valid!") : util.debug("Credentials were NOT valid: " + self.stream.authorizationError);

			self.connected = true;
			self.stream.setEncoding('utf8');
			OnDemand.register(config, version);

		});

		self.stream.on("data", function(data){
			util.debug(" -- Data received:" + data);
			var msg = JSON.parse(data);
			if(msg.event == "ping")
				self.pong();
			else
				self.stream.emit('event', msg.event, msg.data);
		})

		self.stream.on("error", function(error){
			console.log(error.message);
			self.stream.end();
		})

		self.stream.on("end", function(){
			console.log(" -- Connection ended");
		})

		self.stream.on("close", function(had_error){
			console.log(" -- Connection closed.")
		});

		callback(self.stream);

	},

	register: function(config, version){
		console.log(" -- Registering...");
		var data = {
			client_version: version,
			key: config.device_key,
			group: config.api_key,
			protocol: 1
		}
		this.send('connect', data)
	},

	pong: function(){
		var data = {
			timestamp: Date.now().toString()
		}
		this.send('ping', data)
	},

	send: function(action, data){
		log("Sending action " + action);
		if(self.stream.writable) {
			self.stream.write(JSON.stringify({ action: action, data: data }) + "\n", 'utf8')
		} else {
			log("Stream not writable!!");
		}
	}

}

// sys.inherits(OnDemand, emitter);

exports.connect = function(host, port, config, version, callback){
	return OnDemand.start(host, port, config, version, callback);
}

exports.connected = function(){
	return OnDemand.connected;
}
