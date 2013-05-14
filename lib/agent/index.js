"use strict";

//////////////////////////////////////////
// Prey Node.js Agent
// Written by Tomás Pollak
// (c) 2012, Fork Ltd -- forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var system     = require('./../system'),
    common     = require('./common'),
    hooks      = require('./hooks'),
    exceptions = require('./exceptions'),
    connection = require('./connection'),
    loader     = require('./loader'),
    actions    = require('./actions'),
    reports    = require('./reports'),
    updater    = require('./updater'),
    helpers    = common.helpers,
    config     = common.config,
    logger     = common.logger,
    program    = common.program,
    self;

var Agent = self = {

  running: false,
  interactive: process.stdout._type === 'tty',
  drivers: {},
  gathered_data: [],

  log: function(str){
    logger.info('[agent] ' + str);
  },

  log_notice: function(str){
    logger.notice('[agent] ' + str);
  },

  log_error: function(err) {
    var err = (err instanceof Error) ? err : new Error(err);
    logger.debug(err.stack);
    logger.error("[agent] " + err.message);
    hooks.trigger('err', err);
    if (!process.env.DEBUG && !err.notified) {
      exceptions.send(err);
      err.notified = true;
    }
  },

  run: function(){

    if (this.running) return false;
    process.env.LOOP = 0;

    // if run via cron, wait a few seconds before actually calling engage()
    var wait_seconds = helpers.run_via_cron() ? helpers.random_between(1, 59) : 0;

    setTimeout(function(){

      self.initialize(function(connected){
        hooks.trigger('initialized');
        self.engage();
      });

    }, wait_seconds * 1000);

    if (wait_seconds > 0)
      logger.info('[agent] Sleeping for ' + wait_seconds + ' seconds...');
  },

  engage: function(trigger){

    if (trigger){
      hooks.trigger('trigger', trigger);
      logger.info('Awakened by ' + trigger);

      if (!program.connection_found)
        self.check_connection(1);
    }

    process.env.LOOP++;

    if (Object.keys(self.drivers).length === 0)
      self.load_driver(program.driver || config.get('driver'));

    hooks.trigger('engage');

  },

  can_update: function(){
    return config.get('auto_update') === true &&
           system.paths.versions &&
           (new Date().getHours()) % 3 == 0; // don't check on every single run
  },

  initialize: function(callback){

    // env.RUNNING_USER is user by the updater to check if it was called by the agent
    this.running = true;
    this.running_as = process.env.RUNNING_USER = system.get_running_user();
    this.started_at = new Date();
    this.connect_attempts = config.get('auto_connect') ? 3 : 0;

    // if any actions were requested through the command line
    if (program.run)
      return this.run_command(program.run);

    this.write_header();

    if (program.skipConnectionCheck)
      return callback();

    this.check_connection(1, function(connected){

      // only check for updates if enabled and run via trigger
      if (!connected || !self.can_update())
        return callback(connected);

      self.log('Checking for updates...');
      updater.check(function(err, new_version){
        if (err) self.log_error(err);
        if (!new_version) return callback(connected); // connected should be true

        hooks.trigger('event', 'new_version', new_version);
        self.log_notice('Updated to version ' + new_version + '! Shutting down...');
        self.shutdown();
      });

    });

  },

  write_header: function(){

    var title = "\n  PREY " + common.version + " spreads its wings!";
    logger.write(title, 'light_red');
    logger.write("  Current time: " + this.started_at.toString(), 'bold');

    var info = "  Running under Node " +  process.version + " with PID " + process.pid;
    info += " on a " + process.arch + ' ' + common.os_name + " system as " + this.running_as + "\n";

    logger.write(info);
  },

  check_connection: function(attempt, callback){

    this.log('Checking connection...');

    var no_connection = function(e){
      self.log_error(e);
      self.log_notice('No connection found after ' + attempt + ' attempts.');
      program.connection_found = false;
      hooks.trigger('no_connection');
      callback && callback(false);
    };

    connection.check({ proxy: config.get('proxy_url') }, function(err){

      if (!err) {

        program.connection_found = true;
        hooks.trigger('connection_found');
        if (callback) callback(true);

      } else if (attempt <= self.connect_attempts){

        self.log_notice('Trying to connect to an open Wifi network...');

        system.auto_connect(function(e){
          if (e) return no_connection(e);

          setTimeout(function(){
            self.check_connection(attempt+1, callback);
          }, 10000); // 10 secs to connect

        });

      } else {

        no_connection(err);

      }

    });

  },

  load_driver: function(driver_name, driver_options){

    if (self.drivers[driver_name])
      return self.log_error(new Error(driver_name + " driver already loaded"));

    loader.load_driver(driver_name, function(err, driver_module){

      if (err) return self.log_error(err);
      var options = driver_options || config.get(driver_name);

      self.log("Initializing " + driver_name + " driver...");

      driver_module.load(options, function(err, driver){

        if (err) return self.log_error(err);

        driver.on('driver',  self.load_driver); // driver_name, driver_options
        driver.on('engage',  self.engage); // driver name who calls

        driver.on('update',  self.update_setting); // key, value
        driver.on('toggle',  self.toggle_setting); // key

        driver.on('get',     self.get_data); // getter or report name
        driver.on('report',  self.get_report); // report_name, options
        driver.on('cancel',  self.cancel_report); // report_name

        driver.on('actions', self.start_actions); // array of actions
        driver.on('start',   self.start_action_by_name); // action_name, options
        driver.on('stop',    self.stop_action); // action_name

        driver.on('watch',   self.watch_trigger); // event_name, options
        driver.on('unwatch', self.stop_action);   // a trigger is an action

        driver.on('unload',  self.driver_unloaded); // driver done

        self.drivers[driver_name] = driver_module;

      });

    });

  },

  // if a driver was unloaded (e.g. Ctrl-C in Console)
  // and no other is loaded, then simply disengage
  driver_unloaded: function(err){
    if (Object.keys(self.drivers).length === 1) {
      self.drivers = {};
      if (actions.running_actions.length > 0)
        self.disengage();
    }
  },

  run_command: function(string){
    var matches;

    logger.off();

    if (matches = string.match(/get (\w+)/))
      this.get_data(matches[1]);
    else if (matches = string.match(/[start|stop] (\w+)/))
      this.start_action_by_name(matches[1])

      if (!matches) {
        return logger.on();
      }

      hooks.on('err', function(err){
        console.error(err.message.trim());
      })

      hooks.on('data', function(key, data){
        // console.log(key);
        console.log(JSON.stringify(data, null, 2));
      })

  },

  unload_driver: function(driver_name){
    self.log("Unloading " + driver_name + " driver...");
    var driver = this.drivers[driver_name];

    if (!driver) return;
    delete this.drivers[driver_name];
    driver.unload();
  },

  unload_drivers: function(){
    if (Object.keys(self.drivers).length === 0) return;

    for (var driver_name in this.drivers)
      this.unload_driver(driver_name);

    return true;
  },

  update_settings: function(hash){
    for (var key in hash)
      this.update_setting(key, hash[key]);
  },

  update_setting: function(key, value){
    self.log('Updating setting: ' + key + " -> " + value);

    if (key.trim() == 'delay')
      return self.check_delay(value);

    config.update(key, value, function(err){
      if (err) self.log_error(err);
      else hooks.trigger('event', 'setting_updated', key, value);
    });
  },

  toggle_setting: function(key){
    var current = config.get(key);
    if (!current || typeof current != 'boolean')
      return;

    update_setting(key, !current)
  },

  check_delay: function(requested_delay){

    // make sure delay gets set only when running non-interactively
    // so that we avoid creating multiple crontabs in unices
    if (this.interactive)
      return self.log('Running interactively -- will not update delay.');

    system.set_delay(requested_delay, function(err, current){
      if (err) return self.log_error(new Error('Unable to update delay: ' + err.message));

      hooks.trigger('event', 'setting_updated', 'delay', requested_delay);
	    self.log("Delay updated from " + current + " to " + requested_delay);
    });

  },

  get_report: function(report_name, options){
    var options = options || {};

    if (reports.is_active(report_name))
      this.cancel_report(report_name);

    var when = options.interval ? 'on' : 'once';
    self.log('Requesting ' + report_name + ' report. (' + when + ')');

    reports[when](report_name, function(data){

      if (!data || Object.keys(data).length == 0)
        return self.log_error(new Error(report_name  + 'returned no data.'));

      data.gathered_at = new Date().toUTCString();
      self.send_data(report_name, data);
    });

    reports.get(report_name, options);

  },

  cancel_report: function(report_name){

    logger.info('[agent] Cancelling ' + report_name + ' report.');
    reports.cancel(report_name);

  },

  get_data: function(requested_data){
    if (!this.providers)
      this.providers = require('./providers');

    this.providers.get(requested_data, function(err, data){
      if (err) return self.log_error(err);
      if (data) self.send_data(requested_data, data);
    });

  },

  send_data: function(context, data){

    if (!data || (typeof data === 'object' && Object.keys(data).length <= 0))
      return self.log_notice('No data to send for ' + context);

    this.gathered_data.push(data);
    hooks.trigger('data', context, data);

  },

  load_action_hooks: function(){

    actions.on('action_started', function(action_name){
      hooks.trigger('event', 'action_started', action_name);
    });

    actions.on('action_failed', function(action_name, err){
      if (!err) return;
      hooks.trigger('event', 'action_failed', action_name, err);
      self.log_error(err);
    });

    actions.on('action_finished', function(action_name, err){
      var success = err ? false : true;
      hooks.trigger('event', 'action_finished', action_name, success);
      if (err) self.log_error(err);
    });

    // triggered when all actions return through callback,
    // whether or not some of them may be still running
    actions.on('all_returned', function(running_actions){
      hooks.trigger('event', 'all_actions_returned', running_actions);
    });

    actions.on('event_triggered', function(trigger_name, data){
      self.log_notice('Event triggered: ' + trigger_name);
      hooks.trigger('event', trigger_name, data);
      // if(data) self.send_data(trigger_name, data);
    });

    this.action_hooks_loaded = true;

  },

  start_actions: function(actions_hash, skip_running){
    if (!self.action_hooks_loaded)
      self.load_action_hooks();

    actions.load_and_start(actions_hash, skip_running);
  },

  start_actions_by_name: function(list, skip_running){
    var actions_hash = {};
    list.forEach(function(name){
      actions_hash[name] = true;
    });
    self.start_actions(actions_hash, skip_running);
  },

  start_action_by_name: function(action_name, options){
    var hash = {};
    hash[action_name] = options;
    self.start_actions(hash, true);
  },

  stop_action: function(action_name){
    actions.stop(action_name);
  },

  watch_trigger: function(trigger_name, options){

    if (!self.action_hooks_loaded)
      self.load_action_hooks();

    loader.load_trigger(trigger_name, function(err, module){
      if (err) return;

      module.options = options;
      module.name = trigger_name;
      actions.initialize_and_start([module]);
    });
  },

  delete_files: function(){
    this.log('Removing leftover data...');
    this.gathered_data.forEach(function(data){
      common.helpers.remove_files(data);
    });
  },

  disengage: function(){
    reports.cancel_all();
    actions.stop_all();
    process.nextTick(function(){
      actions.removeAllListeners();
    });
  },

  shutdown: function(){

    if (!this.running) return;

    hooks.trigger('shutdown');

    if (this.unload_drivers()) // true if any drivers are loaded
      this.disengage();

    if (this.gathered_data.length > 0)
      this.delete_files();

    if (config._modified) config.save();
    this.running = false;

  }

};

module.exports = Agent;
