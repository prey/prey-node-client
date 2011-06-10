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

function Module(name, options) {

	var self = this;
	this.name = name;
	this.path = base_path + "/modules/" + name;

	this.traces = {};

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

		// log(" -- Initializing module...");
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

	}

	this.run = function(method){

		log(" -- Running " + self.name + " module...");

		try {
			var core = require(self.path);
		} catch(e){
			debug(e.message);
			log(" !! Error loading module in " + self.path);
			self.emit('end', {});
			return;
		}

		var hook = core.init(self.options);

		hook.on('error', function(msg){
			log(' !! Method returned error: ' + msg)
			hook.emit('method_returned'); // triggers event above
		});

		// trace returned
		hook.on('trace', function(key, val){
			log(" ++ Trace returned from " + self.name + ": " + key + " -> " + val);
			self.traces[key] = val;
			hook.emit('method_returned');
		});

		// method returned
		hook.on('method_returned', function(){
			if(self.methods_total) {
				self.methods_returned++;
				if(self.methods_returned >= self.methods_total)
					hook.emit('end');
			}
		});

		// module is done
		hook.on('end', function(){
			debug(' -- Module execution ended.')
			self.emit('end', self.traces); // returns to caller
		});

		if(method){ // specific method requested

			hook[method]();

		} else {

			if(typeof hook.async_methods === 'undefined'){

				hook.run();

			} else {

				self.methods_total = hook.async_methods.length;

				hook.async_methods.forEach(function(method_name){
					// try {
						hook[method_name]();
					// } catch (e) {
						// console.log(e);
					// }
				});

			}

		}

	}

	this.init(options);

}

sys.inherits(Module, emitter);

// initializes module
exports.new = function(name, options){
	return new Module(name, options);
}

// calls specific method on module with default settings
exports.run = function(name, method){
	return new Module(name, {method: method});
}
