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
    common       = require('./common'),
    config       = common.config,
    logger       = common.logger.prefix('reports'),
    hooks        = require('./hooks');

var reports_path = join(__dirname, 'reports'),
    available, // need to start as null
    active = {};

var prev_auto_connect = config.get('auto_connect'); // to restore when cancelled

var is_active = function(report_name){
  return (active[report_name]);
};

// returns unique elements in array
var unique = function(arr) {
  var temp = {}, r = [];

  for (var i = 0; i < arr.length; i++)
    temp[arr[i]] = true;

  for (var k in temp)
    r.push(k);

  return r;
}

// removes elements in a that are present in b
var reject = function(a, b) {
  return a.filter(function(el){
    if (b.indexOf(el) == -1)
      return el;
  });
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

  // if a report by that name was already queued
  // lets cancel the existing one first
  if (active[report_name] && options.interval)
    cancel(report_name);

  map(function(err, reports) {
    if (err) return cb && cb(err);

    var list = available[report_name] || [];

    if (options.include)
      list = unique(list.concat(options.include));
    if (options.exclude)
      list = reject(list, options.exclude);

    if (list.length == 0) {
      var err = new Error('No data to fetch for "' + report_name + '"');
      hooks.trigger('error', err);
      return cb && cb(err);
    }

    // logger.debug('Gathering: ' + list.join(', '))
    gather(report_name, list, cb); // get one immediately

    if (options.interval)
      queue(report_name, list, options || {});
  });

};

var queue = function(report_name, list, opts) {
  var interval = opts.interval && parseInt(opts.interval);
  if (!interval) return;

  // interval reporting triggered, so force auto connect to true
  config.set('auto_connect', true);

  // in case the delay is sent in minutes
  if (interval < 1000) interval = interval * 60 * 1000;
  logger.info('Queuing ' + report_name + ' report every ' + interval/(60 * 1000) + ' minutes.');

  var timer = setInterval(function(){
    gather(report_name, list);
  }, interval);

  active[report_name] = { timer: timer, options: opts };
};

var gather = function(report_name, list, cb) {

  var data     = {},
      gathered = false,
      count    = list.length;

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

  var done = function(err, result, key) {
    if (result) data[key] = result;
    if (err) logger.error('Unable to get ' + key + ': ' + err.message);

    logger.debug('[' + (count-1) + '/' + list.length + '] Got ' + key);

    --count || finished();
  }

  list.forEach(function(trace) {
    providers.get(trace, done);
  });

};

var cancel = function(report_name) {
  if (!active[report_name])
    return logger.error('Report ' + report_name + ' not active!');

  logger.warn('Canceling ' + report_name + ' report.');
  config.set('auto_connect', prev_auto_connect); // restore original value

  var timer = active[report_name].timer;
  clearInterval(timer);
  // this.removeAllListeners(report_name);
  delete(active[report_name]);
};

var cancel_all = function(){
  for (var report_name in active)
    cancel(report_name);
};

var running = function() {
  var list = [];
  for (var key in active) {
    var obj = { name: key, options: active[key].options };
    list.push(obj);
  }
  return list;
}

exports.map        = map;
exports.get        = get;
exports.running    = running;
exports.cancel     = cancel;
exports.cancel_all = cancel_all;
