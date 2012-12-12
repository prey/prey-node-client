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
    dispatcher = require('./../../dispatcher'),
    request    = require('./request'),
    logger     = common.logger;

var ControlPanelDriver = function(options) {

  var self = this;
  this.name = 'control-panel';

  this.events = {};
  this.interval = {};
  this.active_reports = {};

  this.protocol = 'http://';
  this.host = options.host;
  this.api_key = options.api_key;
  this.device_key = options.device_key;
  this.missing_status_code = 404;

  this.log = function(str){
    logger.info("[driver] " + str);
  };

  this.load = function(callback){
    this.check_keys(function(err){
      if (err) {
        return self.unload() || callback(err);
      }

      self.log("Control Panel keys in place.");
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
    this.base_url = this.protocol + this.host + '/devices/' + this.device_key;
    this.request_format = '.json';

    this.endpoints = {
      device: {
        url: this.base_url + this.request_format,
        method: 'put'
      },
      events: {
        url: this.base_url + '/events' + this.request_format,
        method: 'post'
      },
      reports: {
        url: this.base_url + '/reports' + this.request_format,
        method: 'post'
      }
    };
  }

  this.load_hooks = function(){

    hooks.on('event', function(name, data){
        self.send_event(name, data);
    });

    hooks.on('data', function(name, data){
      self.send_data(name, data, function(err, response){
        if ((err || response.statusCode > 300) && self.active_reports[name])
          self.cancel_report(name);
      });
    });

    hooks.on('trigger', this.start);
  };


  this.start = function(){
    if (common.program.connection_found)
      self.fetch();
  };

  this.fetch = function(){
    var opts = {},
        urls = [this.endpoints.device.url];

    opts.report_status = true;
    opts.proxy_url     = common.config.get('proxy_url');
    opts.user_agent    = common.user_agent;

    request.make(urls, opts, function(err, resp, body){
      if (err) return self.unload(err);

      self.process(body, false);
    });
  };

  this.process = function(response_body){
    var commands;
    
    try {
      commands = JSON.parse(response_body);
    } catch(e) {
      console.log('Invalid response: ' + response_body);
      return false;
    }
    
    commands.forEach(function(msg){
        self.emit(msg.command, msg.name, msg.options);
    })

  };

  this.cancel_report = function(report_name){
    // this.log('Cancelling ' + report_name + ' report.');
    this.emit('cancel', report_name);
    delete this.active_reports[report_name];
  };

  this.send_data = function(key, data, callback){
    if (Object.keys(data).length === 0)
       return callback(new Error('Data was empty for ' + key));

    self.log("Sending " + key + " data...");
    var remote = this.endpoints[key] ? this.endpoints[key] : this.endpoints.data;

    var options = {
      url: remote.url,
      method: remote.method,
      username: this.api_key,
      password: 'x'
    };

    dispatcher.send('http', data, options, callback);
  };

  this.send_event = function(name, data){
    var event = { name: name, info: data };
    this.send_data('events', {event: event});
  };

  this.send_events = function(){
    this.send_data('events', {events: this.events});
    this.events = {};
  };

  this.check_keys = function(callback){
    if (this.device_key === ''){
      logger.warn('Device key not present.');
      if (this.api_key === '')
        callback(new Error('No API key found. Please set up your account.'));
      else
        this.register_device(callback);
    } else {
      callback();
    }
  };

  this.register_device = function(cb){
    logger.info('Attaching device to your account...');
    var register = require('./register');

    register({api_key: this.api_key}, function(err, data){
      if (err || !data.device_key)
        return cb(err || new Error("Couldn't register this device. Try again in a sec."));

      logger.notice('Device succesfully created. Key: ' + data.device_key);
      self.device_key = data.device_key;

      common.config.update('control-panel', {device_key: data.device_key}, cb);
    });
  };

  this.run_setup = function(callback){
    console.log('Please configure your account by running: ');
    console.log(' $ bin/config account setup\n\n');
    process.exit(1);
  };

};

util.inherits(ControlPanelDriver, Emitter);

exports.load = function(options, callback){
  var driver = this.driver = new ControlPanelDriver(options);
  driver.load(callback);
};

exports.unload = function(){
  this.driver.unload();
};
