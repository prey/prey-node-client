//////////////////////////////////////////
// Prey On-Demand Driver
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var fs = require('fs'),
		tls = require('tls'),
		util = require('util'),
		createHash = require('crypto').createHash,
		common = require('./../../../common'),
		logger = common.logger,
		Emitter = require('events').EventEmitter;

var OnDemandDriver = function(options){

	var self = this;
	this.stream = null;
	this.keys = null;
	this.connected = false;
	this.protocol_version = 2;

	this.host = options.host;
	this.port = parseInt(options.port);
	this.device_key = options.device_key;
	this.group_key = options.group_key || 'NONE';

	this.log = function(str){
		logger.info('[on-demand] ' + str);
	};

	this.load = function(callback){

		if (this.connected) return callback(new Error("Already connected."))

		if (!this.host || !this.port)
			return callback(new Error("No host or port given. Cannot connect."))
		else if (!this.device_key)
			return callback(new Error("Cannot connect without valid device key."))

		this.read_keys(function(err){

			if (err) return callback(err);
			self.connect();
			callback(null, self);

		});

	};

	this.unload = function(err){
		if(err) logger.error(err);
		this.disconnect();
		this.emit('unload', err);
	};

	this.read_keys = function(callback){

		this.log("Reading TLS public/private keys...");

		try {

			this.keys = {
				key: fs.readFileSync(common.private_key_path).toString(),
				cert: fs.readFileSync(common.certificate_path).toString()
			};

			callback();

		} catch(e) {

			callback(e);

		}

	};

	this.connect = function(){

		var self = this;
		this.log("Connecting to " + this.host + " at port " + this.port + "...");

		// create and encrypted connection using ssl
		var stream = this.stream = tls.connect(this.port, this.host, this.keys, function(){

			self.log("Connection established.");
			if (stream.authorized)
				self.log("Credentials were valid!")
			else
				self.log("Credentials were NOT valid: " + stream.authorizationError);

			// stream.setEncoding('utf8');
			self.connected = true;
			self.register();

		});

		stream.on("data", function(data){
			self.log("Message received: " + data);
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

	};

	this.process = function(data){

		try{
			var msg = JSON.parse(data);
		} catch(e){
			return logger.error("Syntax error -- non JSON message.");;
		}

		if(msg.event == "ping")
			this.pong();
		else if(msg.event == "message")
			this.process_message(msg.data.body);
		else
			this.emit(msg.event, msg.data);

	};

	this.process_message = function(body){

		if(body == 'run_once')
			this.emit('engage', 'on-demand')
		else
			this.emit(body.command, body.name, body.options)

	};

	this.register = function(){

		this.log("Sending credentials...");
		var group_key = createHash('sha1').update(this.group_key).digest('hex');

		var data = {
			client_version: common.version,
			key: this.device_key,
			group: group_key,
			protocol: this.protocol_version
		}

		this.send('connect', data);
	};

	this.pong = function(){
		this.send('ping', { timestamp: Date.now().toString() })
	};

	this.send = function(action, data){
		this.log("Sending action " + action);

		if(this.stream.writable) {
			// self.stream.write(JSON.stringify({ action: action, data: data }) + "\n", 'utf8');
			this.stream.write(JSON.stringify({ action: action, data: data }))
		} else {
			logger.info(" !! Stream not writable!");
			this.disconnect();
		}

	};

	this.disconnect = function(){
		if (!this.connected || !this.stream) return;

		this.log("Closing On-Demand connection upon request!");
		this.stream.destroy();
	};

}

util.inherits(OnDemandDriver, Emitter);

var instance;

exports.load = function(options, callback){
	instance = new OnDemandDriver(options);
	instance.load(callback);
}

exports.unload = function(){
	instance.unload();
}
