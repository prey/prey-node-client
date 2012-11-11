"use strict";

var fs = require('fs'),
    util = require('util'),
    inspect = util.inspect,
    exp = module.exports,
    _log_file = null,
    indent = '';


exp.set_log_file = function(file) {
  _log_file = file;
  if(fs.existsSync(_log_file)) fs.unlinkSync(_log_file);
};

var _tr = exp._tr  = function(msg) {
  var m = msg.split(/^([0-9]):/);
  
  if (m.length === 1) {
    if (_log_file)
      fs.appendFileSync(_log_file,indent + ' -- '+m[0]+'\n');
    else
      console.log(indent + ' -- '+m[0]);
  }

  if (m.length === 3) {
    var lev = m[1];
    if (lev > 0 || lev !== indent.length) {
      indent = '';
      for (var i = 0; i < lev ; i++)
        indent += ' ';
    }

    var log_line = indent+m[2];
    if (_log_file) 
      fs.appendFileSync(_log_file,log_line+'\n');
    else 
      console.log(log_line);
  }
};

/**
 * Print msg and exit process with given code.
 **/
var exit_process = exp.exit_process = function(error,code) {
  _tr('EXIT_PROCESS ('+code+')');
  _tr(inspect(error));

  if (code) process.exit(code);
  process.exit(0);
};


/**
 * Used in debug_error for getting source file and line of error.
 **/
var whichFile = function() {
  var e = new Error('blah'); 

  var m = e
        .stack
        .split("\n")[3]
        .trim()
        .match(/at (\S+) (\(([A-Z]:)?[^:]+):([0-9]+)/);
  
  return (m) ? {func:m[1],file:m[2],line:m[4] } : null;
};

/**
 * Make sure the directory exists.
 **/
exp.ensure_dir = function(path,callback) {
  fs.exists(path,function(exists) {
    if (exists) return callback(null);
    
    fs.mkdir(path,function(err) {
      if (err) return callback(_error(err));

      callback(null);
    });
  });
};

/**
 * Print the full context of the error and where it was generated 
 * then bails.
 **/
exp.debug_error = function(err,context) {
  // check if first parameter is already an error object
  if (typeof  err === 'object') {
    if (err.error) return err; 
  }

  err = {error:err,context:context,location:whichFile()};
  exit_process(err,1);
};

/**
 * Create an error object - let top level functions handle printing/logging.
 **/
exp.standard_error = function(err,context) {
  if (typeof err === 'object') {
    if (err.error) return err;
  }
  return {error:err,context:context};
};


exp.error = exp.debug_error;

