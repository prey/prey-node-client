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

	this.packed = function(data){
		this.log("All info packed!");
		this.traces = data;
		this.emit('ready');
	};

	this.gather = function(requested_info){

		var provider = require('./data_provider');

		provider.get_many(requested_info, function(data){
			self.packed(data);
		});

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

}

util.inherits(Report, emitter);
module.exports = Report;
