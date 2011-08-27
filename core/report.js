//////////////////////////////////////////
// Prey Report Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		http_client = require(base_path + '/vendor/restler'),
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

	this.send_to = function(destinations){

		destinations.forEach(function(destination) {

			var Transport = require(base_path + '/transports/' + destination);
			var tr = new Transport(self, config.transports.destination);
			tr.send(self.traces);

		});

	}

}

sys.inherits(Report, emitter);
module.exports = Report;
