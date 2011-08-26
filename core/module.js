//////////////////////////////////////////
// Prey Module Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://usefork.com
// GPLv3 Licensed
//////////////////////////////////////////

var sys = require('sys'),
		emitter = require('events').EventEmitter,
		fs = require('fs'),
		path = require('path'),
		Updater = require('./updater');

var instances = {};

function Module(name, options) {

	var self = this;
	this.name = name;
	this.path = base_path + "/prey_modules/" + name;

	this.loaded = false;
	this.returned = false;
	this.traces = {};

	this.methods = null;
	this.called_methods = [];

	this.success_returns = 0;
	this.error_returns = 0;

	this.defaults = function(){
		return require(this.path + "/config").default;
	}

	this.download = function(){
		log(" -- Path not found!")
		this.update();
	},

	this.update = function(){
		log(" ++ Downloading module " + this.name + " from server...")
		var update = new Updater(self);
		update.on('success', function(){
			log(" ++ Module " + self.name + " in place and ready to roll!")
			self.ready();
		});
		update.on('error', function(){
			log(' !! Error downloading package.')
			return false;
		})
	};

	this.check_version = function(upstream_version){

		// get version and check if we need to update
		fs.readFile(this.path + "/version", function(err, data){
			if(err) return false;
			if(parseFloat(upstream_version) > parseFloat(this.version)){
				log(upstream_version + " is newer than installed version: " + this.version);
				self.update();
			} else {
				self.ready();
			}
		})
	};

	this.init = function(options){

		log(" -- Initializing " + self.name + " module...");
		self.config = self.defaults.merge(options.config);

		// download module in case it's not there,
		// or check for updates in case option was selected
		path.exists(this.path, function(exists) {
			if(!exists)
				self.download();
			else if(options.update)
				self.check_version(options.upstream_version);
			else
				self.ready();
		});

	};

	this.load_methods = function(){

		try {
			var Hook = require(self.path);
		} catch(e){
			debug(e.message);
			return false;
		}

		self.methods = new Hook(self.options);
		return true;

	};

	this.add_listeners = function(){
		self.methods.on('error', function(key, msg){
			log(' !! [' + self.name + '] get_' + key + ' returned error: ' + msg);
			self.method_returned(key, false);
		});

		// trace returned
		self.methods.on('trace', function(key, val){
			if(val) self.add_trace(key, val);
			self.method_returned(key, val);
		});
	}

	this.ready = function(){

		self.loaded = self.load_methods();
		if (self.loaded) {

			self.add_listeners();

			console.log(" -- Module " + this.name + " ready.");
			self.emit('ready');
			// self.run();
		} else {
			log(" !! Error loading module in " + self.path);
			self.emit('end', {});
		}
		// if(options.method) self.run(options.method);
	}

	this.when_ready = function(callback){

		if(!this.loaded){
			this.on('ready', function(){
				callback();
			});
		} else {
			callback();
		}

	};


	this.add_trace = function(key, val){
		log(" ++ [" + self.name + "] Got trace: " + key + " -> " + val);
		self.traces[key] = val;
	}

	this.async_run = function(){
		return(self.methods.async_traces !== undefined);
	},

	this.in_async_methods = function(trace_method){
		// return(self.methods.async.indexOf('get_' + trace_method) != -1);
		return(self.async_run() && self.methods.async_traces.indexOf(trace_method) != -1);
	}

	this.methods_pending = function(){
		return (self.methods.async_traces.length > self.error_returns + self.success_returns);
	}

	this.method_returned = function(name, val){
		self.methods.emit(name, val);
		self.called_methods.push(name);

		if(val == false && self.in_async_methods(name))
			self.error_returns++;
		else
			self.success_returns++;

		if(self.async_run() && !self.methods_pending()) self.methods.emit('end');

	}

	this.run = function(){

		var methods = self.methods;
		var method = arguments[0] || false; // specific method called

		log(" -- Running " + self.name + " module...");

		if(method){ // specific method requested

			self.run_method(method);

		} else {

			// module.run() called, lets add an 'end' listener to return to main loop
			methods.once('end', function(){
				log(" !! [" + self.name + '] module execution ended. Removing listeners.')
				// methods.removeAllListeners();
				self.emit('end', self.traces); // returns to caller
			});

			if(methods.async_traces === undefined){

				// try {
					methods.run();
				// } catch(e) {
				//	methods.emit('error', e.message);
				// }

			} else {

				methods.async_traces.forEach(function(trace_name){
					// try {
						self.run_method('get_' + trace_name);
					// } catch (e) {
						// console.log(e);
					// }
				});

			}

		}

	};

	this.method_ran = function(method_name){
		return (self.called_methods.indexOf(method_name) != -1);
	};

	this.run_method = function(method_name){
		// log(" >> Calling method " + method_name + "!");
		if(!self.method_ran(method_name))
			self.methods[method_name]();
	};

	this.get = function(trace_name, callback){

		// log(trace_name);

		if (self.traces[trace_name]) { // trace exists

			callback(self.traces[trace_name]);

		} else if(self.method_ran(trace_name) != -1) {

			callback(false); // already tried and no luck

		} else {

			self.methods.once(trace_name, function(val){
				callback(val);
			});

			self.run('get_' + trace_name);

		}

	};

	this.init(options);

}

sys.inherits(Module, emitter);

function get_or_initialize(name, options){
	if(!instances[name]) instances[name] = new Module(name, options);
	return instances[name];
}

// initializes module
exports.new = function(name, options){
	var mod = get_or_initialize(name, options);
	mod.when_ready(function(){ mod.run() });
	return mod;
}

// calls specific method on module with default settings
exports.run = function(name, method){
	var mod = get_or_initialize(name, {});
	mod.when_ready(function(){ mod.run(method) });
	return mod;
	// return new Module(name, {method: method});
}

// gets specific trace on module with default settings, calls callback when found
exports.get = function(name, trace_name, callback){
	var mod = get_or_initialize(name, {});
	mod.when_ready(function(){ mod.get(trace_name, callback) });
	return mod;
	// return new Module(name, {method: method});
}
