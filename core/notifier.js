//////////////////////////////////////////
// Prey Notifier
// Written by Tomas Pollak
// (c) 2011 - Fork Ltd. - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var config = require('./base').config,
		logger = require('./base').logger,
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

		var transports_returned = 0;
		var destinations = config.destinations;

		destinations.forEach(function(destination) {

			if(destination == 'control_panel'){
				var transport_options = {
					username: config.api_key,
					post_url: options.url,
				}
			} else {
				var transport_options = config.transports[destination];
			}

			transport_options.user_agent = config.user_agent;
			transport_options.proxy = config.proxy;

			var transport = require('./transports/' + destination).init(transport_options);
			tr.send(self.traces);

			tr.once('end', function(){

				if(++transports_returned >= destinations.length)
					self.sent();

			});

		});

	}

}

util.inherits(Notifier, emitter);
module.exports = new Notifier();
