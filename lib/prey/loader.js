"use strict";

//////////////////////////////////////////
// Prey Plugin Loader Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var common = _ns('common'),
    logger = common.logger,
    path = require('path'),
    util = require('util'),
    Emitter = require('events').EventEmitter;

var plugins_path = path.join(common.root_path, 'lib', 'prey', 'plugins');

function mixin(target, source) {
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });
  return target;
}

var Loader = function(){

  this.log = function(str){
    logger.info("[loader] " + str);
  };

  this.load_driver = function(name, callback){
    this.plugin_type = 'driver';
    this.callback = callback;
    _tr("loading "+name);
    this.load(name);

  };

  this.load_action = function(name, callback){

    this.plugin_type = 'action';
    this.callback = callback;
    this.load(name);

  };

  this.load_trigger = function(name, callback){

    this.plugin_type = 'trigger';
    this.callback = callback;
    this.load(name);

  };

  this.load_transport = function(name, callback){

    this.plugin_type = 'transport';
    this.callback = callback;
    this.load(name);

  };

  this.load = function(plugin_name){

    this.plugin_name = plugin_name;

    logger.debug("Loading " + plugin_name + " " + this.plugin_type + "...");
    this.plugin_path = path.join(plugins_path, this.plugin_type + 's', this.plugin_name);

    // just load local plugins for now
    try {
      return this.require(this.plugin_path);
    } catch(e) {
      _tr("ha got excep:"+this.plugin_path);
      return this.failed(e);
    }

/*
    try { // look for the path in plugins

      var mod = require(this.plugin_path);
      if(upstream_version)
        this.update_if_newer(upstream_version);
      else
        this.loaded(mod);

    } catch(e) { // see if we can find it in node_modules path

      if(!e.toString().match(/Cannot find module/))
        return this.failed(e);

      logger.warn("Error loading plugin: " + e);
      try {
        var mod = require(plugin_name);
        this.loaded(mod);
      } catch(e) {
        logger.warn("Error loading plugin: " + e);
        this.install(plugin_name);
      }

    }

*/

  };

  this.update_if_newer = function(upstream_version){

    var installed_version = require(this.plugin_path + '/package').version;

    if(common.helpers.is_greater_than(upstream_version, installed_version)){
      logger.notice(" !! " + upstream_version + " is newer than installed version: " + installed_version);
      this.update();
    } else {
      this.require();
    }
  };

  this.require = function(){
    this.loaded(require(this.plugin_path));
  };

  this.done = function(err, mod){
    this.callback(err, mod);
    // this.emit('done', mod);
  };

  this.loaded = function(mod){

    var self = this;
    if(!mod.name) mod.name = this.plugin_name;
    logger.debug("Plugin " + this.plugin_name + " loaded!");

    self.done(null, mod);
  };

  this.failed = function(e){
    this.done(e);
  };

  this.install = function(plugin_name){
    this.call_npm('install', plugin_name);
  };

  this.update = function(plugin_name){
    this.call_npm('update', plugin_name);
  };

  this.call_npm = function(method, plugin_name){

    // we're not using npm (programatically) for now. TODO!
    return this.failed(_error("Kaboom!"));

    var self = this;
    logger.info("Attempting to " + method + " " + plugin_name);
    var npm = require('npm');

    npm.load({loglevel: 'silent'}, function(err){

      if(err) return self.failed();

      npm.commands[method]([plugin_name], function(e, data){

        if(e) {
          logger.error("Unable to " + method + " " + plugin_name + ": " + e);
          self.failed(e);
        } else {
          logger.info(plugin_name + " " + method  + " success!");
          self.require();
        }

      });

    });

    // npm.on("log", function(message){
      // logger.info(message.msg)
    // })

  };

};

util.inherits(Loader, Emitter);
module.exports = new Loader();
