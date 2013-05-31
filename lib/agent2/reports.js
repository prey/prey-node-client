var logger  = require('./common').logger.prefix('reports'),
    hooks = require('./hooks'),
    reports = {};

'use strict';

//////////////////////////////////////////
// Prey Reports
// Written by Tomas Pollak <tomas@forkhq.com>
// (c) 2012 - Fork Ltd.
// GPLv3 Licensed
//////////////////////////////////////////

var fs           = require('fs'),
    util         = require('util'),
    join         = require('path').join,
    Emitter      = require('events').EventEmitter,
    providers    = require('./providers');

var reports_path = join(__dirname, 'reports'),
    reports_list,
    active = {};

var is_active = function(report_name){
  return (active[report_name]);
};

var map = function(cb) {
  if (reports_list)
    return cb(null, reports_list);

  fs.readdir(reports_path, function(err, files){
    if (err) return cb(err);

    reports_list = {};
    files.forEach(function(report_name) {
      var report = require(join(reports_path, report_name));

      if (report && report.includes)
        reports_list[report_name.replace('.js', '')] = report.includes;
    });

    cb(null, reports_list);
  });

};

var get = function(report_name, options, cb) {

  var options = options || {};
  map(function(err, reports){
    if (err) return cb && cb(err);

    var list = reports[report_name] || [],
        cb = (typeof options === 'function') ? options : cb;

    if (options.include)
      list = list.concat(options.include);

    if (list.length == 0) {
      var err = new Error('No data to fetch for ' + report_name);
      hooks.trigger('error', err);
      return cb && cb(err);
    }

    gather(report_name, list, cb); // get one immediately

    if (options.interval)
      queue(report_name, list, options.interval);
  });
};

var queue = function(report_name, list, interval) {
  if (!interval) return;

  // in case the delay is sent in minutes
  if (interval < 1000) interval = interval * 60 * 1000;

  active[report_name] = setInterval(function(){
    gather(report_name, list);
  }, interval);

};

var gather = function(report_name, list, cb) {

  var data = {},
      count = list.length;

  var done = function(err, result, key){
    if (result) data[key] = result;
    logger.info('[' + (count-1) + '/' + list.length + '] Got ' + key);

    // once ready, callback (if passed) or emit via hooks
    --count || (cb && cb(null, data)) || hooks.emit('report', report_name, data);
  }

  list.forEach(function(trace) {
    providers.get(trace, done);
  });

};

var cancel = function(report_name){
  if (!active[report_name]) return;

  clearInterval(active[report_name]);
  // this.removeAllListeners(report_name);
  delete(active[report_name]);
};

var cancel_all = function(){
  for (var report_name in active)
    cancel(report_name);
};

exports.get        = get;
exports.cancel     = cancel;
exports.cancel_all = cancel_all;
