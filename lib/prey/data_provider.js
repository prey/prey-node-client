var fs = require('fs'),
		providers_path = __dirname + '/providers';

var DataProvider = function(){

	var self = this;
	this.getters = {};

	this.map = function(){

		var files = fs.readdirSync(providers_path);
		// console.log(files);

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

	this.get = function(trace_name, options, callback){

		var provider = this.getters[trace_name];

		if(typeof provider == 'undefined')
			return callback(false);

		if(typeof options == 'function')
			require(provider).get(trace_name, options);
		else
			require(provider).get(trace_name, options, callback);

	};

	this.get_many = function(traces, callback){

		var data = {};
		var traces_count = Object.keys(traces).length;

		for(var trace in traces){

			var options = traces[trace];

			this.get(trace, options, function(result){

				data[trace] = result;
				if(process.env.DEBUG) console.log("Got " + trace + ". " + traces_count + " traces pending");
				--traces_count || callback(data);

			});

		}

	};

	this.map();

};

module.exports = new DataProvider();
