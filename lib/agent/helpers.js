"use strict";

var common = require('./common'),
    fs     = require('fs'),
    path   = require('path'),
    exec   = require('child_process').exec,
    spawn  = require('child_process').spawn;

// returns true if first is greater than second
exports.is_greater_than = function(first, second){
  var a = parseFloat(first.replace(/\./, ''));
  var b = parseFloat(second.replace(/\./, ''));
  return a > b ? true : false;
};

exports.random_between = function(from, to){
  return Math.floor(Math.random() * (to - from + 1) + from);
};

// when run via cron, env.TERM is 'dumb' or empty
exports.run_via_cron = function(){
  return process.platform != 'win32' &&
  (!process.env.TERM || process.env.TERM == 'dumb');
}

exports.run_via_cli = function(){
  return process.env.TERM || process.env.PROMPT;
}

exports.remove_files = function(data){
  if (data.file && data.content_type)
    return exports.remove_file(data);

  for(var key in data){
    var val = data[key];
    if (!val) continue;
    if (val.file && val.content_type)
      exports.remove_file(val);
  }
};

exports.remove_file = function(file, cb){
  fs.unlink(file.file, cb);
};

exports.run_detached = function(cmd, args, cb){
  var child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return child;
};

/**
 * A modified async.memoize that takes into account errors.
 * If there's an error it will return the arguments as provided _and_ remove any existing memo.
 **/
exports.memoize = function (fn, hasher) {
  var memo = {};
  var queues = {};
  hasher = hasher || function (x) {
    return x;
  };
  var memoized = function () {
    var args = Array.prototype.slice.call(arguments);
    var callback = args.pop();
    var key = hasher.apply(null, args);
    if (key in memo) {
      callback.apply(null, memo[key]);
    }
    else if (key in queues) {
      queues[key].push(callback);
    }
    else {
      queues[key] = [callback];
      fn.apply(null, args.concat([function () {

        // if we don't have an error then cache ...
        // the assumption here is a callback always has an null/err as first param

        var q = queues[key];
        delete queues[key];

        if (arguments[0] === null) {
          memo[key] = arguments;
        } else {
          if (memo.key)
            delete memo[key]; // on error remove existing key
        }

        // process queued callbacks with the results of the call ...
        for (var i = 0, l = q.length; i < l; i++) {
          q[i].apply(null,arguments);
        }

      }]));
    }
  };
  memoized.unmemoized = fn;
  return memoized;
};
