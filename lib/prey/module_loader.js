//////////////////////////////////////////
// Prey Module Loader Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common')
		logger = common.logger,
		path = require('path'),
		fs = require('fs'),
		util = require('util'),
		emitter = require('events').EventEmitter;
//		ModuleUpdater = require('./module_updater');

var modules_path = common.root_path + '/plugins';

var ModuleLoader = function(module_name, upstream_version, module_config){

	var self = this;
	this.module_name = module_name;
	this.module_config = module_config;
	this.upstream_version = null; // so we dont shoot our toes
	// this.upstream_version = upstream_version;

	this.load = function(){

		logger.info("Loading " + this.module_name + " module...");
		this.module_path = modules_path + '/' + this.module_name;

		// download module in case it's not there,
		// or check for updates in case option was selected
		path.exists(this.module_path, function(exists) {
			if(!exists){
				try {
					var mod = require(self.module_name);
					logger.warn('Module found in node_modules path!');
					return self.done(mod);
				} catch(e){ // not available in node_modules as well
					self.install(self.module_name);
				}
			} else if(self.upstream_version)
				self.update_if_newer(self.upstream_version);
			else
				self.ready();
		});

	};

	this.done = function(mod){
		this.emit('done', mod);
	}

	this.ready = function(){

		var mod = require(this.module_path);
		mod.config = this.module_config;
		if(!mod.name) mod.name = this.module_name;

		this.done(mod);
		logger.debug("Module " + this.module_name + " loaded!")

	};

	this.failed = function(e){
		this.done(null);
	}

	this.install = function(){
		this.call_npm('install');
	}
	
	this.update = function(){
		this.call_npm('update');
	}

	this.update_if_newer = function(upstream_version){

		var installed_version = require(this.module_path + '/package').version;

		if(common.helpers.is_greater_than(upstream_version, installed_version)){
			logger.notice(" !! " + self.upstream_version + " is newer than installed version: " + version);
			this.update();
		} else {
			this.ready();
		}

	}
	
	this.call_npm = function(method){
		
		logger.info("Attempting to " + method + " " + this.module_name);
		var npm = require('npm');

		npm.load({loglevel: 'silent'}, function(err){

			if(err) return self.failed();

			npm.commands[method]([self.module_name], function(e, data){

				if(e) {
					logger.error("Unable to " + method + " " + self.module_name + ": " + e);
					self.failed();
				} else {
					logger.info(self.module_name + " " + method  + " success!");
					self.ready();
				}

			})

		});

		// npm.on("log", function(message){
			// logger.info(message.msg)
		// })

	}

}

util.inherits(ModuleLoader, emitter);

exports.load = function(module_name, upstream_version, module_config){
	var ml = new ModuleLoader(module_name, upstream_version, module_config || {});
	ml.load();
	return ml;
}