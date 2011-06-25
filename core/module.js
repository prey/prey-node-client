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
		updater = require('./updater');

var instances = {};

function Module(name, options) {

	var self = this;
	this.name = name;
	this.path = base_path + "/modules/" + name;

	this.traces = {};

	this.methods = null;
	this.methods_total = null;
	this.methods_returned = 0;

	this.defaults = function(){
		return require(this.path + "/config").default;
	}

	this.ready = function(){
		// console.log(" -- Module ready.");
		if(options.method) self.run(options.method);
	}

	this.download = function(){
		log(" -- Path not found!")
		this.update();
	},

	this.update = function(){
		log(" ++ Downloading module " + this.name + " from server...")
		var update = updater.module(self);
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

		debug("Initializing " + self.name + " module...");
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
			var core = require(self.path);
		} catch(e){
			debug(e.message);
			log(" !! Error loading module in " + self.path);
			self.emit('end', {});
			return false;
		}

		return self.methods = core.init(self.options);

	};

	this.add_trace = function(key, val){
		log(" ++ [" + self.name + "] Got trace: " + key + " -> " + val);
		self.traces[key] = val;
	}

	this.run = function(method){

		var methods = self.methods || self.load_methods();
		if(!methods) return false;

		log(" -- Running " + self.name + " module...");

		methods.on('error', function(method, msg){
			log(' !! Method returned error: ' + msg)
			methods.emit(method, false);
			methods.emit('return', false);
		});

		// trace returned
		methods.on('trace', function(key, val){
			if(val) self.add_trace(key, val);
			methods.emit(key, val);
			methods.emit('return', true);
		});

		// method returned
		methods.on('return', function(success){
			if(self.methods_total) {
				self.methods_returned++;
				if(self.methods_returned >= self.methods_total)
					methods.emit('end');
			}
		});

		// module is done
		methods.on('end', function(){
			debug(self.name + ' module execution ended.')
			self.emit('end', self.traces); // returns to caller
		});

		if(method){ // specific method requested

			methods[method]();

		} else {

			if(typeof methods.async === 'undefined'){

				try {
					methods.run();
				} catch(e) {
					methods.emit('error', e.message);
				}

			} else {

				self.methods_total = methods.async.length;

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

		if (!self.traces[trace_name]) {

			self.methods.on(trace_name, function(val){
				if(!val) callback(false);
				else callback(true, self.traces[trace_name]);
			});

			self.run('get_' + trace_name);

		} else {
			callback(false, val);
		}


	};

	this.init(options);

}

sys.inherits(Module, emitter);

// initializes module
exports.new = function(name, options){
	if(!instances[name]) instances[name] = new Module(name, options);
	return instances[name];
}

// calls specific method on module with default settings
exports.run = function(name, method){
	exports.new(name, {method: method});
	// return new Module(name, {method: method});
}

// calls specific method on module with default settings
exports.get = function(name, trace_name){
	exports.new(name, {}).get(trace_name);
	// return new Module(name, {method: method});
}
