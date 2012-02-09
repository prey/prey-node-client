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

	this.log = function(str){
		logger.info("[loader] " + str);
	};

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

		this.log("Loading " + module_name + " " + this.module_type + "...");
		this.module_path = modules_path + '/' + this.module_type + 's/' + this.module_name;
		
		// return this.done(require(this.module_path));
		
		try { // look for the path in plugins
			var mod = require(this.module_path);
			if(upstream_version)
				this.update_if_newer(upstream_version);
			else
				this.done(mod);
		} catch(e) { // see if we can find it in node_modules path
			logger.warn("Error loading plugin: " + e);
			try {
				var mod = require(this.module_name);
				this.done(mod);
			} catch(e) {
				logger.warn("Error loading plugin: " + e);
				this.install(self.module_name);
			}
		}

	};

	this.update_if_newer = function(upstream_version){

		var installed_version = require(this.module_path + '/package').version;

		if(common.helpers.is_greater_than(upstream_version, installed_version)){
			logger.notice(" !! " + self.upstream_version + " is newer than installed version: " + version);
			this.update();
		} else {
			this.require();
		}

	}

	this.require = function(){
		var mod = require(this.module_path);
		this.done(mod);
	};

	this.done = function(mod){
		mod.options = this.module_options;
		if(!mod.name) mod.name = this.module_name;
		logger.debug("Plugin " + this.module_name + " loaded!")
		this.callback(mod);
		// this.emit('done', mod);
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
					self.require();
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
