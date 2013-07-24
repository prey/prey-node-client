"use strict";

var fs       = require('fs'),
    spawn    = require('child_process').spawn,
    helpers  = {};

// returns true if first is greater than second
helpers.is_greater_than = function(first, second){
  var a = parseFloat(first.replace(/\./, ''));
  var b = parseFloat(second.replace(/\./, ''));
  return a > b ? true : false;
};

helpers.get_option = function(singular) {
  var plural = singular + 's';
  var arr = program[singular] ? [program[singular]] : (config.get(plural) || '').split(', ');
  return arr[0] == '' ? [] : arr;
}

// assume on background if no terminal attached, or stdout is not a tty
helpers.running_on_background = function() {
  return (!process.stdout.isTTY || process.env.TERM == 'dumb');
}

helpers.random_between = function(from, to){
  return Math.floor(Math.random() * (to - from + 1) + from);
};

helpers.remove_files = function(files) {
  files.forEach(function(entry) {
    if (entry.file && entry.content_type)
      fs.unlink(entry.file);
  });
};

helpers.run_detached = function(cmd, args){
  var child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
  child.unref();
  return child;
};


module.exports = helpers;
