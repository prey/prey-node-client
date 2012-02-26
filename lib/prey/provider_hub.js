//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		fs = require('fs'),
		path = require('path'),
		providers_path = __dirname + '/plugins/providers',
		reports_path = __dirname + '/plugins/reports';

/*
var mixin = function(target, source){
	Object.keys(source).forEach(function(key) {
		target[key] = source[key];
	});
	return target;
}
*/

var ProviderHub = function(){

	var self = this;
	this.getters = {};
	this.reports = {};

	this.map = function(){

		var files = fs.readdirSync(providers_path);

		files.forEach(function(provider_name, i){

			var provider_path = path.join(providers_path, provider_name);
			var provider_getters = require(provider_path).getters;

			if(provider_getters){

				provider_getters.forEach(function(getter){

					// console.log(getter + " -> " + provider_name);
					self.getters[getter] = provider_path;

				});

			}

		});
		
		var reports = fs.readdirSync(reports_path);
		
		reports.forEach(function(report_name, i){
			
			var includes = require(path.join(reports_path, report_name)).includes;
			if(includes) self.reports[report_name.replace('.js', '')] = includes;
			
		})

	};
	
	this.get = function(name, options, callback){

		if(Object.keys(this.getters) == 0) this.map();
		var callback = typeof options == 'function' ? options : callback;

		if(this.reports[name]){
			
			var list = this.reports[name]; // this.reports[name].concat(options);
			this.get_many(list, callback);

		} else {

			this.get_one(name, options, function(err, key, result){
				callback(err, result);
			});

		}

	};

	this.get_many = function(list, callback){
		
		var data = {};
		var traces_count = list.length;

		list.forEach(function(trace){
			
			self.get_one(trace, {}, function(err, key, result){

				if(result) data[key] = result;
				logger.debug("Got " + key + ". " + traces_count + " traces pending.");
				--traces_count || callback(null, data);

			});
			
		});

	};

	this.get_one = function(trace_name, options, callback){

		var provider = this.getters[trace_name];

		if(typeof provider == 'undefined') 
			return callback(new Error("Unable to find provider for " + trace_name));

		require(provider).get(trace_name, function(err, result){
			callback(err, trace_name, result);
		})

	};

};

var instance = module.exports = new ProviderHub();
