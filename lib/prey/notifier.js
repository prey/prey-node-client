//////////////////////////////////////////
// Prey Notifier
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
		plugin_loader = require('./plugin_loader');

var Notifier = function(){

	var self = this;

	this.log = function(str){
		logger.info("[notifier] " + str);
	};

	this.sent = function(destinations){
		this.log('Sent to ' + destinations.length + ' destinations!');
		this.emit('sent', destinations);
	};
	
	this.get_default_transports = function(){
		var transports = [];
		config.endpoints.forEach(function(transport_name){
			plugin_loader.load_transport(transport_name, {}, null, function(loaded_transport){
				transports.push(loaded_transport);
			})
			self.default_transports = transports;
		})
		return transports;
	};

	this.send = function(data, transports){

		var transports = transports || this.default_transports || this.get_default_transports();
		var transports_count = transports.length;
		var successful = [];
		
		this.log("Sending " + Object.keys(data).length + " traces to " + transports_count + " endpoints");

		transports.forEach(function(transport){

			var message = transport.send(data, transport.options);
			message.once('end', function(err, data){

				if(!err) successful.push(transport.name);
				--transports_count || self.sent(successful);

			});

		});
		
		return this;

	}

}

util.inherits(Notifier, emitter);
module.exports = new Notifier();
