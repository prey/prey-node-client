//////////////////////////////////////////
// Prey Reports
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		util = require('util'),
		fs = require('fs'),
		path = require('path'),
		Emitter = require('events').EventEmitter,
		providers = require('./provider'),
		reports_path = __dirname + '/plugins/reports';

/*
var mixin = function(target, source){
	Object.keys(source).forEach(function(key) {
		target[key] = source[key];
	});
	return target;
}
*/

var Reports = function(){

	var self = this;
	this.reports = {};
	this.active = {};

	this.map = function(){

		var reports = fs.readdirSync(reports_path);

		reports.forEach(function(report_name, i){

			var includes = require(path.join(reports_path, report_name)).includes;
			if(includes) self.reports[report_name.replace('.js', '')] = includes;

		})

	};

	this.get = function(report_name, options, interval){

		if(Object.keys(this.reports) == 0) this.map();
		// var callback = typeof options == 'function' ? options : callback;

		if(this.reports[report_name]){

			var list = this.reports[report_name];
			if(typeof options == 'object')
				list = list.concat(options instanceof Array ? options : Object.keys(options));

			this.queue(report_name, list, interval);

		} else {

			callback(new Error("Unable to find report " + report_name);

		}

	};

	this.queue = function(report_name, list, interval){

		if(!interval)
			return this.gather(report_name, list);

		this.intervals[report_name] = setInterval(function(){
			this.gather(report_name, list);
		}, interval);

	};

	this.gather = function(report_name, list){

		var data = {};
		var count = list.length;

		list.forEach(function(trace){

			providers.get_data(trace, function(err, key, result){

				if(typeof data[key] != 'undefined') return;
				if(result) data[key] = result;

				logger.debug("Got " + key + ". " + count + " pieces pending.");

				--count || self.emit(report_name, data);

			});

		});

	};

	this.cancel = function(report_name){

		if(this.intervals[report_name])
			clearInterval(this.intervals[report_name]);

	};

};

util.inherits(Reports, Emitter);
var instance = module.exports = new Reports();
