//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		fs = require('fs'),
		path = require('path'),
		providers_path = __dirname + '/plugins/providers';

/*
var mixin = function(target, source){
	Object.keys(source).forEach(function(key) {
		target[key] = source[key];
	});
	return target;
}
*/

var Providers = function(){

	var self = this;
	this.getters = {};

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

	};

	this.get = function(name, callback){

		if(Object.keys(this.getters) == 0) this.map();
		// var callback = typeof options == 'function' ? options : callback;

		this.get_data(name, function(err, key, result){
			callback(err, result);
		});

	};

	this.get_data = function(trace_name, callback){

		var provider = this.getters[trace_name];

		if(typeof provider == 'undefined')
			return callback(new Error("Unable to find provider for " + trace_name));

		require(provider).get(trace_name, function(err, result){
			callback(err, trace_name, result);
		})

	};

};

var instance = module.exports = new Providers();
