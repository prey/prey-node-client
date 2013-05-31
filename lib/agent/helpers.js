"use strict";

var fs       = require('fs'),
    spawn    = require('child_process').spawn,
    // join     = require('path').join,
    // remember = require(join('..', 'utils', 'remember'))
    helpers  = {};

// returns true if first is greater than second
helpers.is_greater_than = function(first, second){
  var a = parseFloat(first.replace(/\./, ''));
  var b = parseFloat(second.replace(/\./, ''));
  return a > b ? true : false;
};

helpers.random_between = function(from, to){
  return Math.floor(Math.random() * (to - from + 1) + from);
};

// when run via cron, env.TERM is 'dumb' or empty
helpers.run_via_cron = function(){
  return process.platform != 'win32'
    && (!process.env.TERM || process.env.TERM == 'dumb');
}

helpers.run_via_trigger = function(){
  return !!process.env.TRIGGER;
}

helpers.run_via_service = function(){
  return (process.platform == 'win32' && !process.env.HOMEPATH);
}

helpers.run_via_daemon = function(){
  return helpers.run_via_cron()
      || helpers.run_via_trigger()
      || helpers.run_via_service();
}

helpers.remove_files = function(files) {
  files.forEach(function(entry) {
    if (entry.file && entry.content_type)
      fs.unlink(entry.file);
  });
};

helpers.run_detached = function(cmd, args, cb){
  var child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return child;
};


module.exports = helpers;
