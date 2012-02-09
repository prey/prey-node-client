//////////////////////////////////////////
// Prey OnDemand Connection Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		tls = require('tls'),
		path = require('path'),
		util = require('util'),
		// crypto = require('crypto'),
		common = require('./common'),
		config = common.config,
		logger = common.logger;

var OnDemand = {

	stream: null,
	keys: null,
	connected: false,
	protocol_version: 2,

	log: function(str){
		logger.info('[on-demand] ' + str);
	},

	start: function(options, callback){

		this.get_keys(function(){
			OnDemand.connect(options, callback);
		});

		return this;

	},

	get_keys: function(callback){

		if(OnDemand.keys == null){

			if(!path.existsSync(common.private_key_path)){

				logger.warn("SSL keys not found! Generating...");

				require('child_process').exec('ssl/generate.sh', function(error, stdout, error){
					logger.info(stdout);
					if(!error) OnDemand.read_keys(callback);
				});

			} else OnDemand.read_keys(callback);

		}

	},

	read_keys: function(callback){

		this.log("Reading TLS public/private keys...");

		this.keys = {
			key: fs.readFileSync(common.private_key_path).toString(),
			cert: fs.readFileSync(common.certificate_path).toString()
		};

		callback();

	},

	connect: function(options, callback){

		var self = this;
		this.log("Connecting to " + options.host + " at port " + options.port);

		// create and encrypted connection using ssl
		var stream = tls.connect(options.port, options.host, this.keys, function(){

			self.log("Connection established.");
			if (stream.authorized)
				self.log("Credentials were valid!")
			else
				self.log("Credentials were NOT valid: " + stream.authorizationError);

			// stream.setEncoding('utf8');
			self.connected = true;
			self.register();

		});

		this.stream = stream;

		stream.on("data", function(data){
			self.log("Data received from On-Demand Hub: " + data);
			self.process(data);
		})

		stream.on("error", function(error){
			self.log("On-Demand error: " + error.code);
			stream.end();
		})

		stream.on("end", function(){
			self.log("On-Demand connection ended");
		})

		stream.on("close", function(had_error){
			// console.log(had_error);
			self.log("On-Demand connection closed.");
			self.connected = false;
		});

		callback(stream);

	},
	
	process: function(data){

		try{
			var msg = JSON.parse(data);	
		} catch(e){
			console.log("Syntax error -- non JSON message.");
			return false;
		}

		if(msg.event == "ping")
			this.pong();
		else
			this.stream.emit('command', msg.command, msg.data);
	},

	register: function(){
		this.log("Registering on On-Demand Hub...");
		// var group_key = crypto.createHash('sha1').update(config.api_key).digest('hex');
		var group_key = config.api_key;
		var data = {
			client_version: common.version,
			key: config.device_key,
			group: group_key,
			protocol: this.protocol_version
		}
		this.send('connect', data);
	},

	pong: function(){
		var data = {
			timestamp: Date.now().toString()
		}
		this.send('ping', data)
	},

	send: function(action, data){
		this.log("Sending action " + action);
		if(this.stream.writable) {
			// self.stream.write(JSON.stringify({ action: action, data: data }) + "\n", 'utf8');
			this.stream.write(JSON.stringify({ action: action, data: data }))
		} else {
			logger.info(" !! Stream not writable!");
			this.disconnect();
		}
	},

	disconnect: function(){
		if(!this.connected) return;
		this.log("Closing On-Demand connection upon request!");
		this.stream.destroy();
	}

}

exports.connected = OnDemand.connected;

exports.connect = function(options, callback){
	return OnDemand.start(options, callback);
}

exports.disconnect = OnDemand.disconnect;
