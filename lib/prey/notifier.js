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
		emitter = require('events').EventEmitter;

function mixin(target, source) {
	Object.keys(source).forEach(function(key) {
		target[key] = source[key];
	});
	return target;
}

var Notifier = function(){

	var self = this;

	this.log = function(str){
		logger.info("[notifier] " + str);
	};

	this.sent = function(destinations){
		this.log('Sent to ' + destinations.length + ' destinations!');
		this.emit('sent', destinations);
	};

	this.send = function(data, destinations){

		var destinations_length = Object.keys(destinations).length;
		var successful = [];

		this.log("Sending " + Object.keys(data).length + " objects to " + destinations_length + " destinations");

		for(var destination in destinations){

			var transport_opts = mixin(config.destinations[destination] || {}, destinations[destination]);
			transport_opts.proxy = config.proxy;

			if(destination == 'control_panel'){
				destination = 'http';
				transport_opts.username = config.api_key;
				transport_opts.password = 'x';
			}

			if(process.env.DEBUG) console.log(transport_opts);

			var transport = require('./transports/' + destination).init(transport_opts);
			transport.send(data);

			transport.once('end', function(success){

				if(success) successful.push(destination);
				--destinations_length || self.sent(successful);

			});

		}

		return this;

	}

}

util.inherits(Notifier, emitter);
module.exports = new Notifier();
