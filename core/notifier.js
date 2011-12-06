//////////////////////////////////////////
// Prey Notifier
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		config = base.config,
		logger = base.logger,
		util = require('util'),
		emitter = require('events').EventEmitter;

var Notifier = function(){

	var self = this;

	this.log = function(str){
		logger.info("[notifier] " + str);
	};

	this.sent = function(destiations){
		this.log('Sent to ' + destinations.length + ' destinations!');
		this.emit('sent', destinations);
	};

	this.send = function(data, options){

		options |= {};
		var transports_returned = 0;
		var successful = [];
		var destinations = config.destinations;

		this.log("Sending " + data.length + " bytes to " + destinations.length + " destinations");

		destinations.forEach(function(destination) {

			if(destination == 'control_panel'){
				destination = 'http';
				var transport_options = {
					username: config.api_key,
					password: 'x',
					url: options.url || 'http://test.com/whatever'
				}
			} else {
				var transport_options = config.transports[destination];
			}

			transport_options.user_agent = base.user_agent;
			transport_options.proxy = config.proxy;

			var transport = require('./transports/' + destination).init(transport_options);
			transport.send(data);

			transport.once('end', function(success){

				if(success) successful.push(destination);

				if(++transports_returned >= destinations.length)
					self.sent(successful);

			});

		});

		return this;

	}

}

util.inherits(Notifier, emitter);
module.exports = new Notifier();
