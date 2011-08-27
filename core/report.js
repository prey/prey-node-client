//////////////////////////////////////////
// Prey Report Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		http_client = require(base_path + '/vendor/restler'),
		emitter = require('events').EventEmitter

var Report = function(data, options){

	var self = this;
	this.options = options;
	this.data = data;

	this.send_to = function(destinations){

			destinations.forEach(function(destination) {

			var Transport = require(base_path + '/transports/' + destination);
			var tr = new Transport(self, config.transports.destination);
			tr.send(self.data);

		});

	}

}

sys.inherits(Report, emitter);
module.exports = Report;
