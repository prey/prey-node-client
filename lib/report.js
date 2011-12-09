//////////////////////////////////////////
// Prey Report Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		util = require('util'),
		fs = require('fs'),
		emitter = require('events').EventEmitter;

var Report = function(){

	var self = this;
	this.traces = {};

	this.log = function(str){
		logger.info(" -- [report] " + str);
	};

	this.empty = function(){
		this.traces = [];
		this.remove_files();
	};

	this.remove_files = function(){

		this.log("Cleaning up files...")
		for(i in this.traces){

			for(t in this.traces[i]){

				var trace = this.traces[i][t];

				if(trace.path) {

					self.log("Removing " + trace.path)

					fs.unlink(trace.path, function(){
						self.log("Removed!");
					});

				}

			}

		}

	};

	this.gather = function(requested_info){

		// TODO!
		console.log(requested_info);

		var report_modules_count = requested_info.length;
		var modules_returned = 0;

		requested_info.forEach(function(prey_module){

			// TODO: check whether we should use 'once' instead of 'on'
			prey_module.once('end', function(){

				modules_returned++;
				var modules_to_go = report_modules_count - modules_returned;

				var traces_count = Object.keys(this.traces).length;
				self.log(this.name + " module returned, " + traces_count + " traces gathered. " + modules_to_go.toString() + " to go!");

				if(traces_count > 0) self.traces[this.name] = this.traces;

				if(modules_to_go <= 0){
					self.log("All report modules returned!");
					self.emit('ready');
				}

			});

			prey_module.init(prey_module.config);
			prey_module.run();

		});

	};

}

util.inherits(Report, emitter);
module.exports = Report;
