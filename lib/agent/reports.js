"use strict";

//////////////////////////////////////////
// Prey Reports
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var fs        = require('fs'),
    util      = require('util'),
    join      = require('path').join,
    Emitter   = require('events').EventEmitter,
    providers = require('./providers');

var reports_path = join(__dirname, 'reports');

/*
var mixin = function(target, source){
  Object.keys(source).forEach(function(key) {
    target[key] = source[key];
  });
  return target;
}
*/

var Reports = function(){

  this.reports = {};
  this.active = {};

  this.map = function(cb) {
    if (Object.keys(this.reports) > 0)
      return cb && cb(null, this.reports);

    var self = this,
        reports = {};

    fs.readdir(reports_path, function(err, file_list){
      if (err) return cb && cb(err);

      file_list.forEach(function(report_name) {
        var report = require(join(reports_path, report_name));

        if (report && report.includes)
          reports[report_name.replace('.js', '')] = report.includes;
      });

      self.reports = reports;
      cb && cb(null, reports);

    });

  };

  this.exists = function(report_name) {
    if (!self.reports) this.map();
    return (!!self.reports[report_name]);
  };

  this.get = function(report_name, options, cb) {

    var self = this;

    this.map(function(err, reports){
      if (err) return cb && cb(err);

      var list = reports[report_name],
          cb = (typeof options === 'function') ? options : cb;

      if (list) {

        if (options.include) list = info.concat(options.include);
        self.gather(report_name, list, cb); // get one immediately

        if (options.interval)
          self.queue(report_name, list, options.interval);

      } else {

        cb && cb(_error('Report not found: ' + report_name));

      }

    });
  };

  this.queue = function(report_name, list, interval) {
    if (!interval) return;

    // in case the delay is sent in minutes
    if (interval < 1000) interval = interval * 60 * 1000;

    this.active[report_name] = setInterval(function(){
      this.gather(report_name, list);
    }, interval);

  };

  this.gather = function(report_name, list, cb) {

    var self = this,
        data = {},
        count = list.length;

    list.forEach(function(trace) {

      providers.get(trace, function(err, result, key) {

        if (typeof data[key] !== 'undefined') return; // not part of report
        if (result) data[key] = result;

        // console.log("Got " + key + ". " + count + " pieces pending.");

        // once ready, callback (if passed) or emit
        --count || (cb && cb(null, data)) || self.emit(report_name, data);
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
