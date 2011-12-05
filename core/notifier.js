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
		logger.info(" -- [notifier] " + str);
	};

	this.sent = function(){
		this.log('Sent to all destinations!');
		this.emit('sent');
	};

	this.send = function(data, options){

		options |= {};
		var transports_returned = 0;
		var destinations = config.destinations;

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

			transport.once('end', function(){

				if(++transports_returned >= destinations.length)
					self.sent();

			});

		});

	}

}

util.inherits(Notifier, emitter);
module.exports = new Notifier();
