//////////////////////////////////////////
// Prey Data Dispatcher
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		config = common.config,
		user_agent = common.user_agent,
		logger = common.logger,
		util = require('util'),
		emitter = require('events').EventEmitter,
		plugins = require('./plugin_loader');

var Dispatcher = function(){

	var self = this;

	this.log = function(str){
		logger.info("[notifier] " + str);
	};

	this.sent = function(destinations){
		this.log('Sent to ' + destinations.length + ' destinations!');
		this.emit('sent', destinations);
	};
	
	this.load_transport = function(endpoint_name, callback){

		plugins.load_transport(endpoint_name, {}, null, callback);

	};
	
	this.send = function(endpoint_name, data, options, callback){
		
		this.load_transport(endpoint_name, function(transport){
			
			if(!transport)
				return callback(new Error("Unable to load transport for " + endpoint_name));

			var package = transport.send(data, options);
			package.once('end', callback);
	
		})

	}

}

util.inherits(Dispatcher, emitter);
module.exports = new Dispatcher();
