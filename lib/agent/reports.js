"use strict";

//////////////////////////////////////////
// Prey Reports
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var logger = _ns('common').logger,
    util = require('util'),
    fs = require('fs'),
    path = require('path'),
    Emitter = require('events').EventEmitter,
    providers = _ns('providers'),
    reports_path = __dirname + '/plugins/reports';

/*
var mixin = function(target, source){
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });
  return target;
}
*/

var Reports = function(){

  var self = this;
  this.reports = null;
  this.active = {};

  this.map = function(callback) {
    if (self.reports) return self.reports;

    self.reports = {};

    var reports_list = fs.readdirSync(reports_path);

    reports_list.forEach(function(report_name) {
      var includes = require(path.join(reports_path, report_name)).includes;
      if (includes) self.reports[report_name.replace('.js', '')] = includes;
    });

    callback && callback(self.reports);
  };

  this.exists = function(report_name) {
    if (!self.reports) this.map();
    return (!!self.reports[report_name]);
  };

  this.get = function(report_name, options, callback) {
    if (!self.reports) this.map();

    callback = (typeof options == 'function') ? options : callback;
    var list = self.reports[report_name];
    if (list) {
      if (options.include) list = list.concat(options.include);
      this.queue(report_name, list, options.interval);
      if (callback) callback(null,list);
    } else {
      if (callback)
        callback(_error("Unable to find report " + report_name));
      _tr("Unable to find report ",report_name);
    }
  };

  this.queue = function(report_name, list, interval) {
    // get one immediately
    this.gather(report_name, list);
    if (!interval) return;
    // in case the delay is sent in minutes
    if (interval < 1000) interval = interval * 60 * 1000;

    this.active[report_name] = setInterval(function(){
      this.gather(report_name, list);
    }, interval);
  };

  this.gather = function(report_name, list) {
    var data = {};
    var count = list.length;
    list.forEach(function(trace) {
      providers.get(trace, function(err, key, result) {

        _tr('gathered',result)
        if (typeof data[key] !== 'undefined') return;
        if (result) data[key] = result;

        logger.debug("Got " + key + ". " + count + " pieces pending.");

        if (!--count)
          self.emit(report_name, data);
      });
    });
  };

  this.is_active = function(report_name){
    return (this.active[report_name]);
  };

  this.cancel = function(report_name){
    if (!this.active[report_name]) return;

    clearInterval(this.active[report_name]);
    this.removeAllListeners(report_name);
    delete(this.active[report_name]);
  };

  this.cancel_all = function(){
    for (var report in this.active)
      this.cancel(report);
  };

};

util.inherits(Reports, Emitter);
module.exports = new Reports();
