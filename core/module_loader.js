//////////////////////////////////////////
// Prey Module Loader Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var path = require('path'),
		fs = require('fs'),
		sys = require('sys'),
		emitter = require('events').EventEmitter,
		ModuleUpdater = require('./module_updater');

var ModuleLoader = function(module_name, config){

	var self = this;

	this.get = function(module_name, config){

		log(" -- Initializing " + module_name + " module...");

		this.module_name = module_name;
		this.module_path = modules_path + '/' + module_name;

		this.config = config;

		// download module in case it's not there,
		// or check for updates in case option was selected
		path.exists(this.module_path, function(exists) {
			if(!exists)
				self.download(module_name);
			else if(config.update)
				self.update_if_newer(config.upstream_version);
			else
				self.ready();
		});

		return self;

	};

	this.ready = function(){

		// if(this.module_name == 'system') return;
//		try {
			var mod = require(this.module_path);
			mod.apply_config(this.config);
			self.emit('loaded', mod);
			log(" == Module " + this.module_name + " loaded!")
//		} catch(e) {
//			console.log(" !! " + e.message);
//			this.failed(this.module_name, e);
//		}
	};

	this.failed = function(e){
		self.emit('failed', this.module_name, e);
	}

	this.download = function(module_name){
		log(" -- Path not found!")
		this.update(module_name);
	}

	this.update = function(module_name){
		log(" ++ Downloading module " + module_name + " from server...")

		var updater = new ModuleUpdater(module_name);

		updater.on('success', function(){
			log(" ++ Module " + self.name + " in place and ready to roll!")
			self.ready();
		});
		updater.on('error', function(e){
			log(' !! Error downloading package.')
			self.failed(e);
		})
	}

	this.update_if_newer = function(upstream_version){

		// get version and check if we need to update
		fs.readFile(this.module_path + "/version", function(err, version){

			if(err) return false;
			if(parseFloat(upstream_version) > parseFloat(version)){
				log(upstream_version + " is newer than installed version: " + version);
				self.update(this.module_name);
			} else {
				self.ready();
			}
		})
	}

	this.get(module_name, config);

}

sys.inherits(ModuleLoader, emitter);
module.exports = ModuleLoader;
