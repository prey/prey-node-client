//////////////////////////////////////////
// Prey Plugin Loader Class
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

var modules_path = common.root_path + '/lib/prey/plugins';

function mixin(target, source) {
	Object.keys(source).forEach(function(key) {
		target[key] = source[key];
	});
	return target;
}

var PluginLoader = function(){

	var self = this;

	this.load_action = function(name, options, version, callback){
		
		this.module_type = 'action';
		this.callback = callback;
		this.load(name, options, version);
		
	};
	
	this.load_transport = function(name, options, version, callback){

		this.module_type = 'transport';
		this.callback = callback;
		// merge requested options with default transport options
		var opts = mixin(common.config.transports[name] || {}, options);
		this.load(name, opts, version);
		
	};

	this.load = function(module_name, options, upstream_version){
		
		this.module_name = module_name;
		this.module_options = options;

		logger.info("Loading " + module_name + " module...");
		this.module_path = modules_path + '/' + this.module_type + 's/' + this.module_name;
		
		// download module in case it's not there,
		// or check for updates in case option was selected
		path.exists(this.module_path, function(exists) {
			if(!exists){
				try {
					var mod = require(self.module_name);
					logger.warn('Module found in node_modules path!');
					return self.done(mod);
				} catch(e){ // not available in node_modules as well
					logger.error(e);
					self.install(self.module_name);
				}
			} else if(upstream_version)
				self.update_if_newer(upstream_version);
			else
				self.ready();
		});

	};

	this.update_if_newer = function(upstream_version){

		var installed_version = require(this.module_path + '/package').version;

		if(common.helpers.is_greater_than(upstream_version, installed_version)){
			logger.notice(" !! " + self.upstream_version + " is newer than installed version: " + version);
			this.update();
		} else {
			this.ready();
		}

	}

	this.ready = function(){

		var mod = require(this.module_path);
		mod.options = this.module_options;
		if(!mod.name) mod.name = this.module_name;

		this.done(mod);
		logger.debug("Plugin " + this.module_name + " loaded!")

	};

	this.done = function(mod){
		// this.emit('done', mod);
		this.callback(mod);
	}

	this.failed = function(e){
		this.done(null);
	}

	this.install = function(){
		this.call_npm('install');
	}
	
	this.update = function(){
		this.call_npm('update');
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

util.inherits(PluginLoader, emitter);
module.exports = new PluginLoader();
