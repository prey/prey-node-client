//////////////////////////////////////////
// Prey Plugin Loader Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = require('./common'),
		helpers = common.helpers,
		logger = common.logger,
		path = require('path'),
		fs = require('fs'),
		util = require('util'),
		emitter = require('events').EventEmitter;
//		ModuleUpdater = require('./module_updater');

var modules_path = common.root_path + '/lib/prey/plugins';
var default_config_file = 'config.js.default';

function mixin(target, source) {
	Object.keys(source).forEach(function(key) {
		target[key] = source[key];
	});
	return target;
}

var PluginLoader = function(){

	this.log = function(str){
		logger.info("[loader] " + str);
	};

	this.load_driver = function(name, options, version, callback){
		
		this.module_type = 'driver';
		this.callback = callback;
		this.load(name, options, version);
		
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
		this.module_path = path.join(modules_path, this.module_type + 's', this.module_name);

		this.empty_config_file = path.join(this.module_path, default_config_file);
		this.module_config_file = path.join(common.config_path, this.module_type + 's', this.module_name + ".js");
		
		return this.require(this.module_path);
		
		try { // look for the path in plugins

			var mod = require(this.module_path);
			if(upstream_version)
				this.update_if_newer(upstream_version);
			else
				this.loaded(mod);

		} catch(e) { // see if we can find it in node_modules path

			if(!e.message.match(/Cannot find module/))
				return this.failed();

			logger.warn("Error loading plugin: " + e);
			try {
				var mod = require(module_name);
				this.loaded(mod);
			} catch(e) {
				logger.warn("Error loading plugin: " + e);
				this.install(module_name);
			}

		}

	};

	this.update_if_newer = function(upstream_version){

		var installed_version = require(this.module_path + '/package').version;

		if(common.helpers.is_greater_than(upstream_version, installed_version)){
			logger.notice(" !! " + upstream_version + " is newer than installed version: " + version);
			this.update();
		} else {
			this.require();
		}

	}

	this.require = function(){
		this.loaded(require(this.module_path));
	};

	this.done = function(mod){
		this.callback(mod);
		// this.emit('done', mod);
	}
	
	this.loaded = function(mod){
		
		var self = this;
		mod.options = this.module_options;
		if(!mod.name) mod.name = this.module_name;
	
		this.load_config(function(config){
			if(config) mod.config = config;
			logger.debug("Plugin " + this.module_name + " loaded!")
			self.done(mod);
		})
	}

	this.failed = function(e){
		this.done(null);
	}
	
	this.load_config = function(callback){
		
		var self = this;
		
		try{ // try to load it from /etc/prey/[plugin_type/[plugin_name]
			var module_config = require(this.module_config_file);
			callback(module_config);
		} catch(e){ // not found. if module has config file, copy it
			if(path.existsSync(this.empty_config_file)){
				helpers.copy_file(this.empty_config_file, this.module_config_file, function(err){
					if(err) throw("Couldn't copy " + self.module_name + " config file to " + self.module_config_file);
					var module_config = require(self.module_config_file);
					callback(module_config);
				});
			} else {
				callback(null);
			}
		}
	}

	this.install = function(module_name){
		this.call_npm('install', module_name);
	}
	
	this.update = function(module_name){
		this.call_npm('update', module_name);
	}
	
	this.call_npm = function(method, module_name){

		var self = this;
		logger.info("Attempting to " + method + " " + module_name);
		var npm = require('npm');

		npm.load({loglevel: 'silent'}, function(err){

			if(err) return self.failed();

			npm.commands[method]([module_name], function(e, data){

				if(e) {
					logger.error("Unable to " + method + " " + module_name + ": " + e);
					self.failed();
				} else {
					logger.info(module_name + " " + method  + " success!");
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
