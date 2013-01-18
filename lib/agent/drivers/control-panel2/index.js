//////////////////////////////////////////
// Prey Control Panel Driver
// Written by Tomas Pollak
// (c) 2011, Fork Ltd. http://forkhq.com
// Licensed under the GPLv3
//////////////////////////////////////////

"use strict";

var fs         = require('fs'),
    util       = require('util'),
    path       = require('path'),
    Emitter    = require('events').EventEmitter,
    common     = require('./../../common'),
    hooks      = require('./../../hooks'),
    reports    = require('./../../reports'),
    dispatcher = require('./../../dispatcher'),
    Heartbeat  = require('./heartbeat'),
    config     = common.config,
    logger     = common.logger;

var ControlPanelDriver = function(options) {

  var self = this;
  var options = options || {};

  this.name       = 'control-panel2';
  this.host       = config.get('host');
  this.protocol   = config.get('protocol') + '://';
  this.api_key    = config.get('api_key');
  this.device_key = config.get('device_key');

  this.log = function(str){
    logger.info("[driver] " + str);
  };

  this.load = function(callback){
    this.check_keys(function(err){
      if (err) return callback(err);

      self.set_urls();
      self.load_hooks();
      self.start();
      callback(null, self); // OK
    });
  };

  this.unload = function(err){
    if (err) logger.error(err);
    hooks.removeAllListeners();
    this.emit('unload', err);
  };

  this.set_urls = function(){
    var base_url = this.protocol + this.host + '/devices/' + this.device_key,
        request_format = '.json';

    this.endpoints = {
      commands: base_url + request_format,
      settings: base_url + '/settings' + request_format,
      events:   base_url + '/events'   + request_format,
      reports:  base_url + '/reports'  + request_format
    }
  }

  this.load_hooks = function(){

    hooks.on('event', function(name, data){
      if (name != 'all_actions_returned')
        self.send_event(name, data);
    });

    hooks.on('data', function(name, data){
      self.send_data(name, data, function(err, resp){
        if (err || resp.statusCode > 300)
          self.cancel_report(name);
      });
    });

    hooks.on('trigger', this.start);
  };

  this.start = function(){
    if (common.program.connection_found)
      self.fetch();
  };

  this.append_status_report = function(req_opts, next){

    var headerize = function(str){
       return str.replace(/_/g, '-')
                 .replace(/(^|\-)\w/g, function($0) { return $0.toUpperCase() });
     };

    reports.get('status', function(err, data){
      if (err) return next(req_opts);

      var headers = {};
      for (var key in data) {
        if (data[key])
          headers['X-' + headerize(key)] = data[key].toString();
      }

      req_opts.headers = headers;
      next(req_opts);
    });
  }

  this.fetch = function(){
    var self = this,
        opts = {},
        url = this.endpoints.commands;

    opts.proxy_url  = common.config.get('proxy_url');
    opts.user_agent = common.user_agent;

    common.system.get_os_info(function(err, info){

      if (!err && info){
        var os_info = info.name + ' ' + info.arch + ' ' + info.version;
        opts.user_agent = common.user_agent.replace(/\w+\)/, os_info + ')');
      }

      var hb = new Heartbeat(url, opts);

      if (options.status_report);
        hb.before(self.append_status_report);

      hb.on('message', function(msg){
        if (msg != '') self.process(msg);
      });

      hb.on('error', function(err){
        logger.error(error);
      });

      hb.once('stopped', function(err){
        self.unload(err);
      });

      hb.start();

    })

  };

  this.process = function(response_body){
    var commands;

    try {
      commands = JSON.parse(response_body);
    } catch(e) {
      logger.error('Invalid response: ' + response_body);
      return false;
    }

    commands.forEach(function(msg){
      if (msg.target == 'report')
        self.emit('report', 'report', msg.options);
      else
        self.emit(msg.command, msg.target, msg.options);
    })
  };

  this.cancel_report = function(report_name){
    // this.log('Cancelling ' + report_name + ' report.');
    this.emit('cancel', report_name);
  };

  this.send_data = function(key, data, callback){
    if (Object.keys(data).length === 0)
       return callback(new Error('Data was empty for ' + key));

    self.log("Sending " + key + " data...");
    var remote = this.endpoints[key] || this.endpoints.reports;

    var options = {
      url: remote,
      method: 'post',
      username: this.api_key,
      password: 'x'
    };

    dispatcher.send('http', data, options, callback);
  };

  this.send_event = function(name, data){
    var event = { name: name, info: data };
    this.send_data('events', {event: event});
  };

  this.check_keys = function(callback){
    if (!this.device_key || this.device_key === ''){
      logger.warn('Device key not present.');
      if (!this.api_key || this.api_key === '')
        callback(new Error('No API key found. Please set up your account.'));
      else
        this.register_device(callback);
    } else {
      callback();
    }
  };

  this.register_device = function(cb){
    logger.info('Attaching device to your account...');
    var remote = require('./remote');

    remote.attach({api_key: this.api_key}, function(err, data){
      if (err || !data.device_key)
        return cb(err || new Error("Couldn't register this device."));

      logger.notice('Device succesfully created. Key: ' + data.device_key);
      self.device_key = data.device_key;

      if (data.settings) {
        for (var key in data.settings) {
          config.set(key, data.settings[key]);
        }
      }

      config.update('device_key', data.device_key, cb);
    });
  };

  this.run_setup = function(callback){
    logger.error('Please configure your account by running: ');
    logger.error(' $ bin/prey config gui\n\n');
    process.exit(1);
  };

};

util.inherits(ControlPanelDriver, Emitter);

exports.load = function(options, callback){
  this.driver = new ControlPanelDriver(options || {});
  this.driver.load(callback);
};

exports.unload = function(){
  if (this.driver)
    this.driver.unload();
};
