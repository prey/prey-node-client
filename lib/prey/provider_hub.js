//////////////////////////////////////////
// Prey Main Provider Class
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var logger = require('./common').logger,
		fs = require('fs'),
		providers_path = __dirname + '/plugins/providers';

var ProviderHub = function(){

	var self = this;
	this.getters = {};

	this.map_getters = function(){

		var files = fs.readdirSync(providers_path);

		files.forEach(function(provider_name, i){

			var provider_path = providers_path + '/' + provider_name;
			var provider_getters = require(provider_path).getters;

			if(provider_getters){

				provider_getters.forEach(function(getter){

					// console.log(getter + " -> " + provider_name);
					self.getters[getter] = provider_path;

				});

			}

		});

	};
	
	this.get_one = function(trace, options, callback){

		var callback = typeof options == 'function' ? options : callback;

		this._get(trace, options, function(err, key, result){
			callback(err, result);
		})
	};

	this.get_many = function(traces, callback){

		var data = {};
		var traces_count = Object.keys(traces).length;

		for(trace in traces){

			var trace_opts = traces[trace];
			this._get(trace, trace_opts, function(err, key, result){

				if(result) data[key] = result;
				logger.debug("Got " + key + ". " + traces_count + " traces pending.");
				--traces_count || callback(null, data);

			});

		}

	};

	this._get = function(trace_name, options, callback){

		if(Object.keys(this.getters) == 0) this.map_getters();

		var provider = this.getters[trace_name];

		if(typeof provider == 'undefined') 
			return callback(new Error("Unable to find provider for " + trace_name));

		require(provider).get(trace_name, function(err, result){
			callback(err, trace_name, result);
		})

	};

};

module.exports = new ProviderHub();
