"use strict";

//////////////////////////////////////////
// Prey Actions Manager Class
// (c) 2011 - Fork Ltd.
// by Tomas Pollak - http://forkhq.com
// GPLv3 Licensed
//////////////////////////////////////////

var
  logger = _ns('common').logger,
  async = require('async'),
  util = require('util'),
  hooks = require('./hooks'),
  loader = require('./loader'),
  Emitter = require('events').EventEmitter;

var ActionsManager = function(){

  var self = this;
  this.running_actions = [];
  this.instances = {};
  this.loaded_modules = {};
  this.registered_events = [];

  this.log = function(str){
    logger.info('[actions] ' + str);
  };

  /**
   *
   **/
  this.load_and_start = function(actions, skip_running){
    this.load_actions(actions, function(err, modules){

      if (err || modules.length <= 0)
        return logger.error("No actions to start.");

      self.initialize_and_start(modules, skip_running);

    });
  };

  /**
   *
   **/
  this.load_actions = function(hash, callback){

    var count = Object.keys(hash).length,
        loaded_modules = [];

    self.log(count + " actions enabled!");

    async.parallel(Object.keys(hash).map(function(requested_module) {

      return function(ascb) {
        loader.load_action(requested_module, function(err, loaded_module){
          if (err) return callback(_error(err));

          loaded_module.name = requested_module;

          if (typeof hash[requested_module] === 'object')
            loaded_module.options = hash[requested_module];

          loaded_modules.push(loaded_module);
          ascb(null, loaded_module);
        });
      };
    }),function() {
      callback(null, loaded_modules);
    });
  };

  this.check_running = function(enabled_actions){

    this.running_actions.forEach(function(running_action){

      if(enabled_actions.indexOf(running_action) === -1){
        logger.notice(running_action.name + " action was turned off!");
        self.stop(running_action.name);
      }

    });

  };

  this.initialize_and_start = function(modules, skip_running){

    if(!skip_running)
      this.check_running(modules);

    this.initialize(modules);
    this.emit('actions_start');
    this.start_all();

  };

  this.initialize = function(enabled_actions){

    this.queued_count = 0;

    enabled_actions.forEach(function(action_module){

      self.loaded_modules[action_module.name] = action_module;

      if(self.is_action_running(action_module)) {
        logger.warn(action_module.name + " is already running!");
      } else {
        self.queue(action_module, action_module.options);
        self.queued_count++;
      }

    });

    // console.log(this.registered_events);
    hooks.unregister_missing(this.registered_events);

  };

  this.is_action_running = function(action_module){
    return (this.running_actions.indexOf(action_module) !== -1) ? true : false;
  };

  this.queue = function(action_module, options){
    logger.debug('Queueing action ' + action_module.name);
    this.initialize_module(action_module);
    this.once('go', function(){
      self.start_action(action_module, options);
    });
  };

  this.initialize_module = function(action_module, options){
    this.register_events(action_module);
    this.load_hooks(action_module);
  };

  this.register_events = function(action_module){

    if(action_module.events && action_module.events.length > 0){
      action_module.events.forEach(function(event_name){
        logger.debug(action_module.name + " announced event: " + event_name);
        self.registered_events.push(event_name);
      });
    }

  };

  this.load_hooks = function(action_module){

    if(action_module.hooks && Object.keys(action_module.hooks).length > 0){
      for(var hook in action_module.hooks){
        hooks.register(hook, action_module.hooks[hook]);
      }
    }

  };

  this.add_event_listeners = function(action_module, emitter){

    if(!action_module.events || action_module.events.length <= 0)
      return false;

    logger.debug("Attaching " + action_module.events.length + " event listeners to " + action_module.name);

    action_module.events.forEach(function(event_name){
      emitter.on(event_name, function(data){
        // hooks.trigger(event_name, data);
        self.emit('event_triggered', event_name, data);
      });
    });

  };

  this.remove_event_listeners = function(action_module, emitter){

    if(!action_module.events || action_module.events.length <= 0)
      return false;

    logger.debug("Removing " + action_module.events.length + " event listeners from " + action_module.name);

    action_module.events.forEach(function(event_name){
      emitter.removeAllListeners(event_name);
    });

  };

  this.start_all = function(){
    this.log("Starting all actions!");
    this.waiting_to_return = this.queued_count;
    this.emit('go');
  };

  this.start_action = function(action, options){

    if(!action.start)
      return this.waiting_to_return--;

    this.log('Starting action ' + action.name);
    this.running_actions.push(action);

    action.started_at = new Date();
    this.emit('action_started', action.name, action.started_at);

    this.instances[action.name] = action.start(options || {}, function(err, data){
      self.action_returned(action, err, data);
    });

    // if(instance && instance.emit && action_module.events){
    // action_module.emitter = instance;
    // this.wait_until_finished(action_module, instance);
    // }

  };

  this.action_returned = function(action, err, returned_data){

    var timediff = new Date() - action.started_at;
    var msg = action.name + ' returned after ' + timediff/1000 + ' seconds. ';
    msg += err ? "No success" : "All good.";
    this.log(msg);

    logger.debug("Waiting to return: " + this.waiting_to_return);
    if (!--this.waiting_to_return)
      this.emit('all_returned');

    var instance = this.instances[action.name];

    if(!err && (action.events || (instance && instance.emit)))
      this.wait_until_finished(action);
    else
      this.action_finished(action, err, returned_data);

  };

  this.wait_until_finished = function(action_module){

    var emitter = this.instances[action_module.name];
    if(!emitter || !emitter.emit)
      return this.action_finished(action_module, new Error("Not an emitter instance."));

    this.emit('action_running', action_module.name);
    this.add_event_listeners(action_module, emitter);

    emitter.once('end', function(err, data){
      delete self.instances[action_module.name];
      self.remove_event_listeners(action_module, emitter);
      self.action_finished(action_module, err, data);
    });

  };

  this.action_finished = function(action_module, err, data){
    logger.debug("Action finished: " + action_module.name);
    this.emit('action_finished', action_module.name, err, data);
    this.remove_from_running(action_module);
  };

  this.remove_from_running = function(action_module){
    var index = this.running_actions.indexOf(action_module);
    this.running_actions.splice(index, 1);
  };

  this.stop_all = function(){

    if(this.running_actions.length <= 0)
      return this.log("No actions are running.");

    this.log("Stopping all actions!");

    this.running_actions.forEach(function(action_module){
      self.stop(action_module.name);
    });

  };

  this.stop = function(action_name){

    var action_module = this.loaded_modules[action_name];

    if(!action_module)
      return logger.error(action_name + " not running!");

    if(!action_module.stop)
      return logger.error(action_name + " not stoppable. Bummer.");

    this.log("Stopping action " + action_name);
    action_module.stop();

  };

};

util.inherits(ActionsManager, Emitter);
module.exports = new ActionsManager(); // singleton
