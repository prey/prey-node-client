//////////////////////////////////////////
// Prey Node.js Agent
// Written by Tomás Pollak
// (c) 2012, Fork Ltd -- forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

var common     = require('./common'),
    config     = common.config,
    logger     = common.logger,
    program    = common.program,
    delay      = require('./delay'),
    updater    = require('./updater'),
    system     = require('./plugins/providers/system'),
    hooks      = require('./hooks'),
    connection = require('./connection'),
    loader     = require('./loader'),
    actions    = require('./actions'),
    reports    = require('./reports'),
    self;

var Agent = self = {

  running: false,
  interactive: process.stdout._type == 'tty',
  drivers: {},
  gathered_data: [],

  log: function(str){
    logger.info('[agent] ' + str);
  },

  log_error: function(err){
    logger.error("[agent] " + err.toString());
    logger.debug(err.stack);
    hooks.trigger('error', err.toString());
  },

  get_running_user: function(){
    return process.env.USER || process.env.USERNAME || 'System';
  },

  run: function(){

    if (this.running) return false;
    process.env.LOOP = 0;

    // if run via cron, wait a few seconds before actually calling engage()
    var start_wait_time = (!common.terminal || common.terminal == 'dumb')
      ? common.helpers.random_between(1, 59) : 0;

    setTimeout(function(){

      system.get('logged_user', function(err, user_name){

        if(!err && user_name)
          process.env.LOGGED_USER = user_name.split("\n")[0];

        self.initialize(function(connected){

          hooks.trigger('initialized');
          self.engage();

        });

      });

    }, start_wait_time * 1000);

    if(start_wait_time > 0)
      logger.debug('[agent] Sleeping for ' + start_wait_time + ' seconds...');

  },

  engage: function(trigger){

    if(trigger){
      hooks.trigger('trigger', trigger);
      logger.info('Awakened by ' + trigger)

      if (!program.connection_found)
        self.check_connection(1);
    }

    process.env.LOOP++;

    if (Object.keys(self.drivers).length === 0)
      self.load_driver(program.driver || config.get('driver'));

    hooks.trigger('engage');

  },

  initialize: function(callback){

    this.running = true;
    this.running_as = process.env.RUNNING_USER = this.get_running_user();
    this.started_at = new Date();
    this.write_header();

    // make sure the running interval is set correctly
    this.check_delay(60);

    // if any actions were requested through the command line
    if(program.actions)
      this.start_actions_by_name(program.actions.split(','));

    this.check_connection(1, function(connected){

      // only check for updates if enabled and run via trigger
      if(!connected || self.interactive || !config.get('auto_update'))
        return callback(connected);

      updater.check(function(err, new_version){

        if (err) self.log_error(err);
        if (!new_version) return callback(connected);

        hooks.trigger('event', 'new_version', new_version);
        logger.notice("Updated to version " + new_version + "! Shutting down...");
        self.shutdown();

      });

    });

  },

  write_header: function(){

    var title = "\n  PREY " + common.version + " spreads its wings!";
    logger.write(title, 'light_red');
    logger.write("  Current time: " + this.started_at.toString(), 'bold');

    var info = "  Running with PID " + process.pid + " on a " + common.os_name;
    info += " system as " + this.running_as + "\n";
    info += "  Detected logged user: " + process.env.LOGGED_USER + "\n";
    info += "  NodeJS version: " + process.version + "\n";

    logger.write(info);

  },

  check_connection: function(attempt, callback){

    logger.info('[agent] Checking connection...');

    var no_connection = function(e){
      logger.warn("[agent] No connection found after " + attempt + " attempts.");
      program.connection_found = false;
      hooks.trigger('no_connection');
      if (callback) callback(false);
    }

    var options = config.get('try_proxy') ?
      {proxy: config.get('proxy_url')} : {};

    connection.check(options, function(err){

      if (!err){

        program.connection_found = true;
        hooks.trigger('connection_found');
        if (callback) callback(true);

      } else if (attempt <= config.auto_connect_attempts){

        logger.notice("[agent] Trying to connect to an open Wifi network...");

        common.os.auto_connect(function(e){

          if (e) return no_connection(e);

          setTimeout(function(){
            self.check_connection(attempt+1, callback);
          }, config.get('auto_connect_timeout') || 10000); // 10 secs to connect

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

      logger.info("[agent] Initializing " + driver_module.name + " driver...");

      driver_module.load(options, function(err, driver){

        if (err) return self.log_error(err);

        driver.on('driver',  self.load_driver); // driver_name, driver_options
        driver.on('set' ,    self.update_setting); // key, value
        driver.on('get',     self.get_data); // getter or report name

        driver.on('engage',  self.engage); // driver name who calls

        driver.on('report',  self.get_report); // report_name, options
        driver.on('cancel',  self.cancel_report); // report_name

        driver.on('actions', self.start_actions); // array of actions
        driver.on('start',   self.start_action_by_name); // action_name, options
        driver.on('stop',    self.stop_action); // action_name

        driver.on('watch',   self.watch_trigger); // event_name, options
        driver.on('unwatch', self.stop_action);   // a trigger is an action

        driver.on('unload',  self.driver_unloaded) // driver done
      });

      self.drivers[driver_module.name] = driver_module;

    });

  },

  // if a driver was unloaded (e.g. Ctrl-C in Console)
  // and no other is loaded, then simply disengage
  driver_unloaded: function(err){
    if (Object.keys(self.drivers).length == 1){
      // self.disengage();
      self.drivers = {};
    }
  },

  unload_driver: function(driver_name){
    logger.info("[agent] Unloading " + driver_name + " driver...")
    var driver = this.drivers[driver_name];

    if (!driver) return;
    delete this.drivers[driver_name];
    driver.unload();
  },

  unload_drivers: function(){
    if (Object.keys(self.drivers).length == 0) return;

    for (driver_name in this.drivers)
      this.unload_driver(driver_name);

    return true;
  },

  update_settings: function(hash){
    for (key in hash)
      this.update_setting(key, hash[key]);
  },

  update_setting: function(key, value){
    self.log("Setting new value for " + key + ": " + value);
    config.update(key, value, function(err){
      if (err) self.log_error(err);
      else hooks.trigger('event', 'setting_updated', key, value);
    });
  },

  check_delay: function(requested_delay){

    // make sure delay gets set only when running non-interactively
    // so that we avoid creating multiple crontabs in unices
    if (!this.interactive)
      delay.set(requested_delay);

  },

  get_report: function(report_name, options){

    if (reports.is_active(report_name))
      return self.log_error('[agent] Report ' + report_name + ' already requested!')

    var when = options.interval ? 'on' : 'once';
    logger.info('[agent] Requesting ' + report_name + ' report. (' + when + ')')

    reports[when](report_name, function(data){
      if (!data) return;
      data.gathered_at = new Date().toUTCString();
      self.send_data(report_name, data);
    });

    reports.get(report_name, options);

  },

  cancel_report: function(report_name){

    logger.info('[agent] Cancelling ' + report_name + ' report.')
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

    if (!data || (typeof data == 'object' && Object.keys(data).length <= 0))
      return logger.notice("No data to send for " + context);

    this.gathered_data.push(data);
    hooks.trigger('data', context, data);

  },

  load_action_hooks: function(){

    actions.on('action_started', function(action_name, when){
      hooks.trigger('event', action_name + '_started', when);
    });

    actions.on('action_running', function(action_name){
      hooks.trigger('event', action_name + '_running');
    });

    actions.on('action_finished', function(action_name, err, data){
      hooks.trigger('event', action_name + '_finished', err);
      if (err) self.log_error(err);
      if (data) self.send_data(action_name, data);
    });

    // triggered when all actions return through callback,
    // whether or not some of them may be still running
    actions.on('all_returned', function(running_actions){
      hooks.trigger('event', 'all_actions_returned', running_actions);
    });

    actions.on('event_triggered', function(trigger_name, data){
      logger.notice("Event triggered: " + trigger_name);
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
    })
    self.start_actions(actions_hash, skip_running);
  },

  start_action_by_name: function(action_name, options){
    var hash = {};
    hash[action_name] = options;
    self.start_actions(hash, true)
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
      actions.initialize_and_start([module]);
    });
  },

  delete_files: function(){
    this.log('Removing leftover data...');
    this.gathered_data.forEach(function(data){
      common.helpers.remove_files(data);
    })
  },

  disengage: function(){
    actions.stop_all();
    actions.removeAllListeners();
    reports.cancel_all();
  },

  shutdown: function(){

    if (!this.running) return;

    hooks.trigger('shutdown');

    if (this.unload_drivers())
      this.disengage();

    if (this.gathered_data.length > 0)
      this.delete_files();

    if (config._modified) config.save();
    this.running = false;

  }

}

module.exports = Agent;
