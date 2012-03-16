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
		providers = require('./providers'),
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

	this.exists = function(report_name){

		if(Object.keys(this.reports) == 0) this.map();
		return(!!this.reports[report_name]);

	};

	this.get = function(report_name, options){

		if(Object.keys(this.reports) == 0) this.map();
		// var callback = typeof options == 'function' ? options : callback;

		if(this.reports[report_name]){

			var list = this.reports[report_name];
			if(options.include) list = list.concat(options.include);

			this.queue(report_name, list, options.interval);

		} else {

			callback(new Error("Unable to find report " + report_name));

		}

	};

	this.queue = function(report_name, list, interval){

		// get one immediately
		this.gather(report_name, list);

		if(!interval) return;
		if(interval < 1000) interval = interval * 60 * 1000; // in case the delay is sent in minutes

		this.active[report_name] = setInterval(function(){
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

		if(this.active[report_name])
			clearInterval(this.active[report_name]);

	};

};

util.inherits(Reports, Emitter);
var instance = module.exports = new Reports();
