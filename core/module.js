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
	this.async_methods_count = null;

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

	this.ready = function(){

		self.loaded = self.load_methods();
		if (self.loaded) {
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
		return(self.methods.async !== undefined);
	},

	this.in_async_methods = function(trace_method){
		// return(self.methods.async.indexOf('get_' + trace_method) != -1);
		return(self.async_run() && self.methods.async.indexOf('get_' + trace_method) != -1);
	}

	this.methods_pending = function(){
		return (self.async_methods_count > self.error_returns + self.success_returns);
	}

	this.method_returned = function(name, val){
		self.methods.emit(name, val);

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


		methods.on('error', function(key, msg){
			log(' !! [' + self.name + '] get_' + key + ' returned error: ' + msg);
			self.method_returned(key, false);
		});

		// trace returned
		methods.on('trace', function(key, val){
			if(val) self.add_trace(key, val);
			self.method_returned(key, val);
		});

		if(method){ // specific method requested

			log(" -- Calling method " + method + "!");
			methods[method]();

		} else {

			// module.run() called, lets add an 'end' listener to return to main loop
			methods.once('end', function(){
				// log(self.name + ' module execution ended.')
				methods.removeAllListeners();
				self.emit('end', self.traces); // returns to caller
			});

			if(methods.async === undefined){

				// try {
					methods.run();
				// } catch(e) {
				//	methods.emit('error', e.message);
				// }

			} else {

				self.async_methods_count = methods.async.length;

				methods.async.forEach(function(method_name){
					// try {
						methods[method_name]();
					// } catch (e) {
						// console.log(e);
					// }
				});

			}

		}

	};

	this.get = function(trace_name, callback){

		if (self.traces[trace_name]) {

			callback(self.traces[trace_name]);

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
