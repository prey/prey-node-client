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
    providers    = require('./providers'),
    logger       = require('./common').logger.prefix('reports'),
    hooks        = require('./hooks');

var reports_path = join(__dirname, 'reports'),
    available, // need to start as null
    active = {};

var is_active = function(report_name){
  return (active[report_name]);
};

// returns unique elements in array
var unique = function(arr) {
  var u = {}, a = [];
  for(var i = 0, l = this.length; i < l; ++i){
    if (u.hasOwnProperty(this[i])) {
       continue;
    }
    a.push(this[i]);
    u[this[i]] = 1;
  }
  return a;
}

var map = function(cb) {
  if (available)
    return cb(null, available);

  fs.readdir(reports_path, function(err, files){
    if (err) return cb(err);

    available = {};
    files.forEach(function(report_name) {
      var report = require(join(reports_path, report_name));

      if (report && report.includes)
        available[report_name.replace('.js', '')] = report.includes;
    });

    cb(null, available);
  });

};

var get = function(report_name, options, callback) {

  if (typeof options == 'function') {
    var cb = options;
    var options = {};
  } else {
    var cb = callback;
    var options = options || {};
  }

  map(function(err, reports){
    if (err) return cb && cb(err);

    var list = available[report_name] || [];

    if (options.include)
      list = unique(list.concat(options.include));

    if (list.length == 0) {
      var err = new Error('No data to fetch for "' + report_name + '" report.');
      hooks.trigger('error', err);
      return cb && cb(err);
    }

    // logger.debug('Gathering: ' + list.join(', '))
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
      gathered = false,
      count = list.length;

  logger.info('Gathering ' + report_name + ' report.');

  var finished = function(){
    if (gathered) return;
    gathered = true;

    logger.info('Report gathered: ' + report_name);

    // once finished, callback (if passed) or emit via hooks
    if (cb)
      return cb(null, data);
    else
      hooks.emit('report', report_name, data);
  }

  var done = function(err, result, key){
    if (result) data[key] = result;
    logger.debug('[' + (count-1) + '/' + list.length + '] Got ' + key);

    --count || finished();
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

exports.map        = map;
exports.get        = get;
exports.cancel     = cancel;
exports.cancel_all = cancel_all;
