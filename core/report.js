//////////////////////////////////////////
// Prey Report Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		sys = require('sys'),
		http_client = require('restler'),
		emitter = require('events').EventEmitter

var Report = function(report_modules, options){

	var self = this;
	this.options = options;
	this.traces = {};

	this.gather = function(){

		var report_modules_count = report_modules.length;
		var modules_returned = 0;

		report_modules.forEach(function(prey_module){

			prey_module.on('end', function(){

				modules_returned++;
				var modules_to_go = report_modules_count - modules_returned;

				var traces_count = Object.keys(this.traces).length;
				log(" -- [" + this.name + "] module returned, " + traces_count + " traces gathered. " + modules_to_go.toString() + " to go!");

				if(traces_count > 0) self.traces[this.name] = this.traces;

				if(modules_to_go <= 0){
					log(" ++ Report gathered!");
					self.emit('ready');
				}

			});

			prey_module.run(true);

		});

	},

	this.send_to = function(destinations, config){

		destinations.forEach(function(destination) {

			if(destination == 'control_panel'){
				var transport_options = {
					username: config.api_key,
					post_url: options.post_url,
				}
			} else {
				var transport_options = config.transports.destination;
			}

			transport_options.user_agent = config.user_agent;
			transport_options.proxy = config.proxy;

			var Transport = require(base.root_path + '/transports/' + destination);
			var tr = new Transport(self, transport_options);
			tr.send(self.traces);

		});

	}

}

sys.inherits(Report, emitter);
module.exports = Report;
