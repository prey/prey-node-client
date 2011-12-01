//////////////////////////////////////////
// Prey Module Loader Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var base = require('./base'),
		path = require('path'),
		fs = require('fs'),
		util = require('util'),
		emitter = require('events').EventEmitter,
		ModuleUpdater = require('./module_updater');

var ModuleLoader = function(module_name, module_config, upstream_version){

	var self = this;
	this.module_name = module_name;
	this.module_config = module_config;
	this.upstream_version = null; // so we dont shoot our toes
	// this.upstream_version = upstream_version;

	this.load = function(){

		log(" -- Initializing " + this.module_name + " module...");
		this.module_path = base.modules_path + '/' + this.module_name;

		// download module in case it's not there,
		// or check for updates in case option was selected
		path.exists(this.module_path, function(exists) {
			if(!exists){
				try {
					var mod = require(self.module_name);
					console.log(' -- Module found in node_modules path!');
					return self.done(mod);
				} catch(e){ // not available in node_modules as well
					self.download(self.module_name);
				}
			} else if(self.upstream_version)
				self.update_if_newer(self.upstream_version);
			else
				self.ready();
		});

	};

	this.done = function(mod){
		self.emit('done', mod);
	}

	this.ready = function(){

		// if(this.module_name == 'system') return;
//		try {
			var mod = require(this.module_path);
			mod.apply_config(this.module_config);

			self.emit('success', mod);
			self.done(mod)

			log(" == Module " + this.module_name + " loaded!")
//		} catch(e) {
//			console.log(" !! " + e.message);
//			this.failed(this.module_name, e);
//		}
	};

	this.failed = function(e){
		self.emit('failed', this.module_name, e);
		self.done(false);
	}

	this.download = function(){
		log(" -- Path not found!")
		this.update();
	}

	this.update = function(){
		log(" ++ Downloading module " + this.module_name + " from server...")

		var updater = new ModuleUpdater(this.module_name);

		updater.on('success', function(){
			log(" ++ Module " + self.module_name + " in place and ready to roll!")
			self.ready();
		});
		updater.on('error', function(e){
			log(' !! Error downloading ' + self.module_name + ' package.')
			self.failed(e);
		})
	}

	this.update_if_newer = function(upstream_version){

		// get version and check if we need to update
		fs.readFile(this.module_path + "/version", function(err, version){

			if(err) return false;
			if(parseFloat(self.upstream_version) > parseFloat(version)){
				log(" !! " + self.upstream_version + " is newer than installed version: " + version);
				self.update();
			} else {
				self.ready();
			}
		})
	}

	this.load();

}

util.inherits(ModuleLoader, emitter);
module.exports = ModuleLoader;
