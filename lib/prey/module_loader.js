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
		emitter = require('events').EventEmitter,
		npm = require('npm');
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
		self.emit('done', mod);
	}

	this.ready = function(){

		var mod = require(this.module_path);
		mod.config = this.module_config;
		if(!mod.name) mod.name = this.module_name;

		self.done(mod);
		logger.debug("Module " + this.module_name + " loaded!")

	};

	this.failed = function(e){
//	self.emit('failed', this.module_name, e);
		self.done(false);
	}

	this.install = function(){
		logger.notice("Installing package " + this.module_name);

		npm.load({}, function(err, cb){

			npm.commands.install([this.module_name], function(err){

				if(err) logger.error("Unable to update " + this.module_name + ": " + err);
				else logger.info(self.module_name + " successfully installed!");

			})

		});

	}

	this.update = function(){

		npm.load({}, function(err, cb){

			npm.commands.update([this.module_name], function(err){

				if(err) logger.error("Unable to update " + this.module_name + ": " + err);
				else logger.info(self.module_name + " successfully updated!");

			})

		});

		return this.failed(); // disable for now, we'll use npm for handling updates

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

}

util.inherits(ModuleLoader, emitter);

exports.load = function(module_name, upstream_version, module_config){
	var ml = new ModuleLoader(module_name, upstream_version, module_config || {});
	ml.load();
	return ml;
}
